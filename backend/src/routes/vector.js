import express from 'express'

export function setupVectorRoutes(app, vectorDB) {
  const router = express.Router()
  
  router.post('/nodes', async (req, res) => {
    try {
      const { id, text, metadata } = req.body
      if (!id || !text) {
        return res.status(400).json({ error: 'Missing required fields: id, text' })
      }
      const document = await vectorDB.addDocument(id, text, metadata)
      res.status(201).json({ success: true, nodeId: id, document })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })
  
  router.get('/nodes/:id', async (req, res) => {
    try {
      const document = await vectorDB.getDocument(req.params.id)
      res.json({ success: true, document })
    } catch (error) {
      res.status(404).json({ error: error.message })
    }
  })
  
  router.put('/nodes/:id', async (req, res) => {
    try {
      const { text, metadata } = req.body
      const updated = await vectorDB.updateDocument(req.params.id, text, metadata)
      res.json({ success: true, document: updated })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })
  
  router.delete('/nodes/:id', async (req, res) => {
    try {
      await vectorDB.deleteDocument(req.params.id)
      res.json({ success: true, message: `Document deleted: ${req.params.id}` })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })
  
  router.post('/search', async (req, res) => {
    try {
      const { query_text, top_k = 5 } = req.body
      if (!query_text) {
        return res.status(400).json({ error: 'Missing required field: query_text' })
      }
      const results = await vectorDB.search(query_text, top_k)
      res.json({ success: true, ...results })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })
  
  router.get('/all', async (req, res) => {
    try {
      const documents = await vectorDB.getAllDocuments()
      res.json({ success: true, totalDocuments: documents.length, documents })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })
  
  router.get('/stats', async (req, res) => {
    try {
      const stats = await vectorDB.getStats()
      res.json({ success: true, stats })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })
  
  app.use('/vector', router)
}
