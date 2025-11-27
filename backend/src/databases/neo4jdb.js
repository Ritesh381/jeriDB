import neo4j from 'neo4j-driver'

const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687'
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j'
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'password'

const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD))

export default class Neo4jDB {
  constructor() {
    this.session = null
    this.driver = driver
  }

  async initialize() {
    try {
      this.session = driver.session()
      await this.session.run('RETURN 1')
      console.log('Neo4j connected')
    } catch (error) {
      console.error('Neo4j connection failed:', error.message)
      throw error
    }
  }

  async addNode(id, nodeData) {
    const query = `
      MERGE (n:Node {id: $id})
      SET n.name = $name, n.type = $type, n.tags = $tags, n += $props
      RETURN n.id
    `
    const result = await this.session.run(query, {
      id,
      name: nodeData.name || id,
      type: nodeData.type || 'unknown',
      tags: nodeData.tags || [],
      props: nodeData
    })
    return result.records[0]?.get('n.id')
  }

  async addEdge(source, target, type, weight = 1) {
    const query = `
      MATCH (a:Node {id: $source}), (b:Node {id: $target})
      MERGE (a)-[r:\`${type}\` {weight: $weight}]->(b)
      RETURN type(r) as relationshipType
    `
    const result = await this.session.run(query, { source, target, weight })
    return result.records[0]?.get('relationshipType')
  }

  graphSearch(query) {
    return []
  }

  async traverse(startId, depth = 1) {
    const query = `
      MATCH (start:Node {id: $startId})-[:USES|WROTE|MENTIONS*1..${depth}]-(related)
      RETURN DISTINCT related.id as id, related.name as name, labels(related) as types
      ORDER BY id
    `
    const result = await this.session.run(query, { startId })
    return result.records.map(record => ({
      id: record.get('id'),
      name: record.get('name'),
      types: record.get('types')
    }))
  }

  async getStats() {
    try {
      const nodesResult = await this.session.run('MATCH (n) RETURN count(n) as totalNodes')
      const edgesResult = await this.session.run('MATCH ()-[r]->() RETURN count(r) as totalEdges')
      
      return {
        totalNodes: nodesResult.records[0]?.get('totalNodes')?.low || 0,
        totalEdges: edgesResult.records[0]?.get('totalEdges')?.low || 0,
        nodeTypes: [],
        driver: 'Neo4j'
      }
    } catch (error) {
      console.error('Neo4j stats error:', error.message)
      return { totalNodes: 0, totalEdges: 0, driver: 'Neo4j (error)', error: error.message }
    }
  }

  async getNode(id) {
    const query = `MATCH (n:Node {id: $id}) RETURN n`
    const result = await this.session.run(query, { id })
    return result.records[0]?.get('n')?.properties || null
  }

  async close() {
    await this.session?.close()
    await driver.close()
  }
}
