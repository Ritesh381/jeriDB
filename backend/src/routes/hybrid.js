import express from 'express'

const router = express.Router()

function validateNodeSchema(data) {
  const required = ['id', 'text']
  const validTypes = ['person', 'org', 'document', 'concept', 'healthcare_ai', 'medical_ml', 'test']
  
  const missing = required.filter(field => !data[field])
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`)
  }
  
  if (data.metadata?.type && !validTypes.includes(data.metadata.type)) {
    throw new Error(`Invalid node type: ${data.metadata.type}. Allowed: ${validTypes.slice(0,3).join(', ')}...`)
  }
  
  return true
}

function validateEdgeSchema(data) {
  const required = ['source', 'target', 'type']
  const validTypes = ['USES', 'MENTIONS', 'CREATED', 'RELATED', 'DEPLOYED']
  
  const missing = required.filter(field => !data[field])
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`)
  }
  
  if (!validTypes.includes(data.type)) {
    throw new Error(`Invalid edge type: ${data.type}. Allowed: ${validTypes.join(', ')}`)
  }
  
  if (data.weight && (data.weight < 0 || data.weight > 1)) {
    throw new Error('Edge weight must be 0-1')
  }
  
  return true
}


function cleanData(data) {
  if (data.nodes?.length || data.edges?.length) return data
  
  if (!data.text?.trim() && !data.content?.trim() && !data.title?.trim()) return null
  
  const cleanText = (data.text || data.content || data.title || data.description || '')
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s.,!?]/g, '')
    .trim()
  
  if (cleanText.length < 10) return null
  
  return { ...data, text: cleanText }
}

function decideRoute(data) {
  const hasText = data.text || data.content || data.title || data.description
  const hasRelationships = data.nodes?.length || data.edges?.length || 
  data.relationships || data.parent_id || data.children
  
  if (hasText && hasRelationships) return 'BOTH'
  if (hasText) return 'VECTOR_ONLY'
  if (hasRelationships) return 'GRAPH_ONLY'
  return 'METADATA_ONLY'
}

async function graphSearch(graphDB, query) {
  try {
    console.log('🔍 Graph searching for:', query)
    const result = await graphDB.driver.session().run(`
      MATCH (n:Node)
      WHERE n.id CONTAINS $query OR 
            toLower(n.name) CONTAINS $query OR 
            toLower(n.type) CONTAINS $query OR
            size([tag in n.tags WHERE toLower(tag) CONTAINS $query]) > 0 OR
            $query IN n.tags
      RETURN n.id as docId, 0.9 as score
      LIMIT 10
    `, { query })
    
    const matches = result.records.map(record => ({
      docId: record.get('docId'),
      score: Number(record.get('score'))
    }))
    console.log('Graph matches found:', matches.length)
    return matches
  } catch (error) {
    console.error('Graph search failed:', error.message)
    return []
  }
}

function mergeResults(vectorResults, graphBoost, vectorWeight) {
  const scored = vectorResults.map(r => {
    const graphScore = graphBoost[r.docId] || 0
    const totalScore = (r.similarity * vectorWeight) + graphScore
    return { ...r, hybrid_score: totalScore }
  })
  return scored.sort((a, b) => b.hybrid_score - a.hybrid_score)
}

export default function hybridRoutes(vectorDB, graphDB) {
  
  router.post('/nodes', async (req, res) => {
    try {
      validateNodeSchema(req.body)
      const { id, text, metadata = {} } = req.body
      if (!id || !text) return res.status(400).json({ error: 'id and text required' })
      
      await vectorDB.addDocument(id, text, metadata)
      await graphDB.addNode(id, { 
        name: metadata.name || id, 
        type: metadata.type, 
        tags: metadata.tags || [],
        ...metadata 
      })
      
      res.json({ success: true, node_id: id, text_length: text.length, driver: 'Neo4j+LanceDB' })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  router.get('/nodes/:id', async (req, res) => {
    try {
      const node = await graphDB.getNode(req.params.id)
      if (!node) return res.status(404).json({ error: 'Node not found' })
      res.json({ success: true, node })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  router.post('/edges', async (req, res) => {
    try {
      validateEdgeSchema(req.body)
      const { source, target, type, weight = 1 } = req.body
      if (!source || !target || !type) return res.status(400).json({ error: 'source, target, type required' })
      
      await graphDB.addEdge(source, target, type, weight)
      res.json({ success: true, edge: { source, target, type, weight }, driver: 'Neo4j' })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  router.get('/search/graph', async (req, res) => {
    try {
      const { start_id, depth = 1 } = req.query
      if (!start_id) return res.status(400).json({ error: 'start_id required' })
      
      const reachable = await graphDB.traverse(start_id, parseInt(depth))
      res.json({ success: true, start_id, depth, nodes: reachable, driver: 'Neo4j' })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  router.post('/search/vector', async (req, res) => {
    try {
      const { query, top_k = 5 } = req.body
      const results = await vectorDB.search(query, top_k)
      res.json({ 
        success: true, 
        query, 
        type: 'vector_only',
        results: results.results.slice(0, top_k),
        total: results.totalResults 
      })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  router.post('/ingest', async (req, res) => {
    try {
      const { data } = req.body
      const cleaned = cleanData(data)
      if (!cleaned) {
        return res.status(400).json({ error: 'Data too noisy or short (<10 chars)' })
      }
      
      const routeDecision = decideRoute(cleaned)
      console.log(`[${routeDecision}] Ingesting:`, cleaned.id || cleaned.text?.substring(0, 50))
      
      if (routeDecision === 'VECTOR_ONLY' || routeDecision === 'BOTH') {
        await vectorDB.addDocument(cleaned.id, cleaned.text, cleaned.metadata || {})
      }
      
      if (routeDecision === 'GRAPH_ONLY' || routeDecision === 'BOTH') {
        if (cleaned.nodes) {
          for (const node of cleaned.nodes) {
            await graphDB.addNode(node.id, node)
          }
        }
        if (cleaned.edges) {
          for (const edge of cleaned.edges) {
            await graphDB.addEdge(edge.from, edge.to, edge.type, edge.weight)
          }
        }
      }
      
      res.json({ 
        success: true, 
        routed_to: routeDecision,
        cleaned_text_length: cleaned.text?.length || 0,
        data_stored: routeDecision 
      })
    } catch (error) {
      console.error('Hybrid ingest failed:', error.message)
      res.status(500).json({ error: error.message })
    }
  })

  router.get('/edges/:id', async (req, res) => {
  try {
    const result = await graphDB.session.run(`
      MATCH (a)-[r]->(b) WHERE id(r) = toInteger($id)
      RETURN type(r) as type, a.id as source, b.id as target, r.weight as weight
    `, { id: req.params.id })
    res.json({ success: true, edge: result.records[0] })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.put('/nodes/:id', async (req, res) => {
  try {
    const { text, metadata } = req.body
    await vectorDB.updateDocument(req.params.id, text, metadata)
    await graphDB.addNode(req.params.id, { ...metadata }) 
    res.json({ success: true, id: req.params.id })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.delete('/nodes/:id', async (req, res) => {
  try {
    await vectorDB.deleteDocument(req.params.id)
    await graphDB.session.run('MATCH (n:Node {id: $id}) DETACH DELETE n', { id: req.params.id })
    res.json({ success: true, deleted: req.params.id })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})


  router.post('/search', async (req, res) => {
    try {
      const { query, type = 'hybrid', vector_weight = 0.7, graph_weight = 0.3, top_k = 5, page=1 } = req.body

      const offset = (page - 1) * top_k
      
      console.log(`🔍 Hybrid search: "${query}" (${type})`)
      
      const vectorResults = await vectorDB.search(query, top_k)
      
      let graphScoreBoost = {}
      if (type === 'hybrid' || type === 'graph') {
        const graphMatches = await graphSearch(graphDB, query)  
        graphMatches.forEach(match => {
          graphScoreBoost[match.docId] = match.score * graph_weight
        })
      }
      
      const hybridResults = mergeResults(vectorResults.results, graphScoreBoost, vector_weight)

      const paginatedResults = hybridResults.slice(offset, offset + top_k)
      
      res.json({
        success: true,
        query,
        type,
        vector_weight,
        graph_weight,
        page,
        top_k,
        total_pages: Math.ceil(hybridResults.length / top_k),
        results: paginatedResults,
        vector_hits: vectorResults.totalResults,
        graph_boosts: Object.keys(graphScoreBoost).length
      })
    } catch (error) {
      console.error('Hybrid search failed:', error.message)
      res.status(500).json({ error: error.message })
    }
  })

  router.get('/stats', async (req, res) => {
    try {
      const vectorStats = await vectorDB.getStats()
      const graphStats = await graphDB.getStats()  
      
      res.json({
        success: true,
        vector: vectorStats,
        graph: graphStats,
        total_nodes: graphStats.totalNodes,
        total_edges: graphStats.totalEdges,
        total_documents: vectorStats.totalDocuments
      })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

router.get('/search/multi-hop', async (req, res) => {
  try {
    const { start_id, hops = 2, relationship_types = '' } = req.query
    if (!start_id) return res.status(400).json({ error: 'start_id required' })
    
    const types = relationship_types ? relationship_types.split(',') : ['USES', 'MENTIONS', 'RELATED']
    const typePattern = types.join('|')
    
    const query = `
      MATCH path=(start:Node {id: $startId})-[r:${typePattern}*1..${hops}]-(related:Node)
      RETURN start {id: start.id, name: start.name} as start_node,
             related {.*, id: related.id} as related_node,
             [rel in relationships(path) | {type: type(rel), weight: rel.weight}] as relationships,
             length(path) as hop_count
      ORDER BY hop_count ASC
      LIMIT 20
    `
    
    const result = await graphDB.driver.session().run(query, { 
      startId: start_id
    })
    
    const paths = result.records.map(record => ({
      start: record.get('start_node'),
      related: record.get('related_node'),
      hop_count: record.get('hop_count').low,
      relationships: record.get('relationships'),
      path_length: record.get('hop_count').low + 1
    }))
    
    res.json({ 
      success: true,
      start_id,
      hops: parseInt(hops),
      paths,
      total_paths: paths.length
    })
  } catch (error) {
    console.error('Multi-hop error:', error.message)
    res.status(500).json({ error: error.message })
  }
})


  return router
}
