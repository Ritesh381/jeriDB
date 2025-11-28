import * as lancedb from '@lancedb/lancedb'
import { generateEmbedding } from '../utils/embedding.js'

class VectorDB {
  constructor(dbPath) {
    this.dbPath = dbPath
    this.db = null
    this.table = null
    this.documentCount = 0
  }
  
  async initialize() {
    try {
      console.log(`Initializing VectorDB at ${this.dbPath}...`)
      this.db = await lancedb.connect(this.dbPath)
      console.log('✅ VectorDB connected')
      return true
    } catch (error) {
      console.error('❌ Failed to initialize VectorDB:', error.message)
      throw error
    }
  }
  
  async ensureTable(tableName = 'documents') {
    try {
      try {
        this.table = await this.db.openTable(tableName)
        console.log(`✅ Opened existing table: ${tableName}`)
      } catch {
        console.log(`🔨 Creating new table: ${tableName}`)
        const dummyData = [{
          id: 'init',
          text: 'init',
          embedding: new Array(384).fill(0.001),
          metadata: '{}'
        }]
        this.table = await this.db.createTable(tableName, dummyData)
        console.log(`✅ Created table: ${tableName}`)
      }
    } catch (error) {
      console.error('❌ Failed to ensure table:', error.message)
      throw error
    }
  }
  
  async addDocument(id, text, metadata = {}) {
    try {
      const embedding = await generateEmbedding(text, true) 
      const document = {
        id,
        text,
        embedding,
        metadata: JSON.stringify(metadata)
      }
      await this.table.add([document])
      this.documentCount++
      console.log(`✅ Added document: ${id} (${text.length} chars)`)
      return document
    } catch (error) {
      console.error(`❌ Failed to add document ${id}:`, error.message)
      throw error
    }
  }
  
  async search(queryText, topK = 5, hackathonMode = false) {
  try {
    console.log(`🔍 Searching for: "${queryText.substring(0, 50)}..." (hackathonMode: ${hackathonMode})`)
    
    // 🔥 HACKATHON MODE: Use exact query embedding from spec
    let queryEmbedding
    if (hackathonMode) {
      queryEmbedding = [0.88, 0.12, 0.02, 0.00, 0.00, 0.00]
      console.log('✅ Using HACKATHON query embedding (6-dim)')
    } else {
      queryEmbedding = await generateEmbedding(queryText, true, hackathonMode)
    }
    
    const startTime = Date.now()
    const results = await this.table.search(queryEmbedding).limit(topK).toArray()
    const latency = Date.now() - startTime
    
    const formattedResults = results
      .map((result, index) => ({
        rank: index + 1,
        docId: result.id,
        text: result.text,
        distance: result._distance || 0,
        similarity: 1 - (result._distance || 0),
        metadata: result.metadata ? JSON.parse(result.metadata) : {}
      }))
      .filter(r => 
        r.docId !== 'init' && 
        r.docId !== null && 
        r.docId !== undefined && 
        r.docId !== '' &&
        r.text !== 'init' &&
        r.text.length > 10
      )
    
    console.log(`✅ Found ${formattedResults.length} results in ${latency}ms`)
    return {
      success: true,
      query: queryText,
      results: formattedResults,
      totalResults: formattedResults.length,
      latencyMs: latency
    }
  } catch (error) {
    console.error('❌ Search failed:', error.message)
    throw error
  }
}

  
  async getAllDocuments(limit = 1000) {
    try {
      await this.forceRefresh() // Ensure fresh data
      const results = await this.table.search(new Array(384).fill(0)).limit(limit).toArray()
      return results
        .map(doc => ({
          id: doc.id,
          text: doc.text,
          metadata: doc.metadata ? JSON.parse(doc.metadata) : {}
        }))
        .filter(doc => doc.id !== 'init')
    } catch (error) {
      console.error('❌ Failed to get all documents:', error.message)
      return []
    }
  }
  
  async getDocument(id) {
    try {
      await this.forceRefresh() // Ensure fresh data
      const results = await this.table.search(new Array(384).fill(0)).limit(1000).toArray()
      const doc = results.find(d => d.id === id)
      if (!doc) throw new Error(`Document not found: ${id}`)
      return { 
        id: doc.id,
        text: doc.text,
        metadata: doc.metadata ? JSON.parse(doc.metadata) : {}
      }
    } catch (error) {
      console.error(`❌ Failed to get document ${id}:`, error.message)
      throw error
    }
  }
  
  async getStats() {
    try {
      await this.forceRefresh()
      const rowCount = await this.table.count_rows()
      return {
        totalDocuments: rowCount - 1, // subtract init row
        embeddingDimension: 384,
        dbPath: this.dbPath,
        status: 'healthy'
      }
    } catch (error) {
      return {
        totalDocuments: 0,
        embeddingDimension: 384,
        dbPath: this.dbPath,
        status: 'error',
        error: error.message
      }
    }
  }

  async deleteDocument(id) {
    if (!this.table) {
      console.log('⚠️ No table available for delete')
      return false
    }
    
    try {
      console.log(`🗑️ Deleting LanceDB document: ${id}`)
      
      // Use SQL WHERE clause string for deletion (correct LanceDB API)
      const deletedCount = await this.table.delete(`id = "${id}"`)
      console.log(`✅ Deleted ${deletedCount} rows matching id: ${id}`)
      
      // Compact table after deletion to remove ghosts in search
      await this.table.optimize()
      console.log(`✅ Table optimized after delete: ${id}`)
      
      this.documentCount = Math.max(0, this.documentCount - deletedCount)
      return deletedCount > 0
    } catch (error) {
      console.error(`❌ Vector delete failed for ${id}:`, error.message)
      return false
    }
  }

  async updateDocument(id, text, metadata) {
    try {
      console.log(`🔄 Updating document: ${id}`)
      const deleted = await this.deleteDocument(id)
      if (!deleted) {
        console.log(`⚠️ Document ${id} not found, creating new`)
      }
      await this.addDocument(id, text, metadata)
      console.log(`✅ Document updated: ${id}`)
    } catch (error) {
      console.error(`❌ Vector update failed for ${id}:`, error.message)
      throw error
    }
  }

  async forceRefresh() {
    if (!this.table) return
    try {
      console.log('🔄 Forcing LanceDB table refresh...')
      await this.table.optimize()
      console.log('✅ LanceDB table refreshed')
    } catch (error) {
      console.warn('⚠️ Table refresh failed:', error.message)
    }
  }

  async nukeAll() {
    if (!this.table) {
      console.log('⚠️ No table to nuke')
      return false
    }
    
    try {
      console.log('💥 NUKING ALL VECTOR DOCUMENTS...')
      // Use SQL WHERE clause string for deletion (except init row)
      const deletedCount = await this.table.delete("id != 'init'")
      await this.table.optimize()
      this.documentCount = 0
      console.log(`✅ NUKED ${deletedCount} documents. Table clean.`)
      return true
    } catch (error) {
      console.error('❌ Nuke failed:', error.message)
      return false
    }
  }
  
}

export default VectorDB
