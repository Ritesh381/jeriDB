import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import { config } from 'dotenv'
import VectorDB from './src/databases/vectordb.js'
import { setupVectorRoutes } from './src/routes/vector.js'
import { initializeRealEmbeddings } from './src/utils/embedding.js'
import hybridRoutes from './src/routes/hybrid.js'  
import Neo4jDB from './src/databases/neo4jdb.js'

config()

const app = express()
const PORT = process.env.PORT || 3000
const DB_PATH = process.env.DB_PATH || '/tmp/hackathon.lancedb'

app.use(cors())
app.use(bodyParser.json({ limit: '50mb' }))

let vectorDB
let graphDB

async function initializeServer() {
  try {
    console.log('Initializing server...')
    
    await initializeRealEmbeddings()
    
    vectorDB = new VectorDB(DB_PATH)
    graphDB = new Neo4jDB()
    await graphDB.initialize()
    
    await vectorDB.initialize()
    await vectorDB.ensureTable('documents')
    
    setupVectorRoutes(app, vectorDB)
    app.use('/hybrid', hybridRoutes(vectorDB, graphDB))  
    
    app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        vector_ready: !!vectorDB?.table,
        graph_ready: true,
        db_path: DB_PATH
      })
    })
    
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`)
      console.log(`Vector DB path: ${DB_PATH}`)
      console.log('ALL ROUTES LOADED')
    })

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('Shutting down server...')
      await graphDB.close()
      process.exit(0)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

initializeServer()
