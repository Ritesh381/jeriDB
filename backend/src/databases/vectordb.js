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
      console.log('VectorDB connected')
      return true
    } catch (error) {
      console.error('Failed to initialize VectorDB:', error.message)
      throw error
    }
  }
  
  async ensureTable(tableName = 'documents') {
    try {
      try {
        this.table = await this.db.openTable(tableName)
        console.log(`Opened existing table: ${tableName}`)
      } catch {
        console.log(`Creating new table: ${tableName}`)
        const dummyData = [{
          id: 'init',
          text: 'init',
          embedding: new Array(384).fill(0.001),
          metadata: '{}'
        }]
        this.table = await this.db.createTable(tableName, dummyData)
        console.log(`Created table: ${tableName}`)
      }
    } catch (error) {
      console.error('Failed to ensure table:', error.message)
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
      console.log(`Added document: ${id}`)
      return document
    } catch (error) {
      console.error(`Failed to add document ${id}:`, error.message)
      throw error
    }
  }
  
  async search(queryText, topK = 5) {
    try {
      console.log(`Searching for: "${queryText}"`)
      const queryEmbedding = await generateEmbedding(queryText, true) 
      const startTime = Date.now()
      
      const results = await this.table.search(queryEmbedding).limit(topK).toArray()
      
      const latency = Date.now() - startTime
      
      const formattedResults = results.map((result, index) => ({
        rank: index + 1,
        docId: result.id,
        text: result.text,
        distance: result._distance || 0,
        similarity: 1 - (result._distance || 0),
        metadata: result.metadata ? JSON.parse(result.metadata) : {}
      })).filter(r => r.docId !== 'init') 
      
      console.log(`Found ${formattedResults.length} results in ${latency}ms`)
      return {
        success: true,
        query: queryText,
        results: formattedResults,
        totalResults: formattedResults.length,
        latencyMs: latency
      }
    } catch (error) {
      console.error('Search failed:', error.message)
      throw error
    }
  }
  
  async getAllDocuments(limit = 1000) {
    try {
      const results = await this.table.search(new Array(384).fill(0)).limit(limit).toArray()
      return results
        .map(doc => ({
          id: doc.id,
          text: doc.text,
          metadata: doc.metadata ? JSON.parse(doc.metadata) : {}
        }))
        .filter(doc => doc.id !== 'init')
    } catch (error) {
      console.error('Failed to get all documents:', error.message)
      return []
    }
  }
  
  async getDocument(id) {
    try {
      const results = await this.table.search(new Array(384).fill(0)).limit(1000).toArray()
      const doc = results.find(d => d.id === id)
      if (!doc) throw new Error(`Document not found: ${id}`)
      return { 
        id: doc.id,
        text: doc.text,
        metadata: doc.metadata ? JSON.parse(doc.metadata) : {}
      }
    } catch (error) {
      console.error(`Failed to get document ${id}:`, error.message)
      throw error
    }
  }
  
  async getStats() {
    return {
      totalDocuments: this.documentCount,
      embeddingDimension: 384,
      dbPath: this.dbPath,
      status: 'healthy'
    }
  }
  async updateDocument(id, text, metadata) {
  try {
    await this.deleteDocument(id)
    await this.addDocument(id, text, metadata)
  } catch (error) {
    console.log('Vector update failed, creating new:', error.message)
    await this.addDocument(id, text, metadata)
  }
}

async deleteDocument(id) {
  if (!this.table) {
    console.log('No table available for delete')
    return
  }
  
  try {
    const filter = lancedb.where(`id == "${id}"`)
    const deletedCount = await this.table.delete(filter)
    console.log(`Deleted ${deletedCount} vector records: ${id}`)
  } catch (error) {
    console.warn(`Vector delete failed for ${id}:`, error.message)
  }
}

}

export default VectorDB
