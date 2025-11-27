Hybrid Vector + Graph Database README
Project Overview
This project implements a hybrid retrieval system that combines a vector database (LanceDB) for semantic similarity search with a graph database (Neo4j) for relationship-based traversal and reasoning. It supports intelligent ingest routing of data and advanced hybrid search including multi-hop graph reasoning, relationship-weighted scoring, pagination, and schema validation. The goal is to enable powerful, explainable retrieval augmented generation (RAG) workflows leveraging the complementary strengths of vector embeddings and knowledge graphs.

Features
Core Features
Hybrid Storage: Store textual data as embeddings in LanceDB and structured relationships in Neo4j.

Data Ingestion: Intelligent routing ingests raw text and graph nodes/edges.

Hybrid Search: Combines vector similarity scoring with graph relationship boosts.

Multi-hop Reasoning: Traverse multiple hops in graph for advanced contextual retrieval.

Schema Validation: Ensures node and edge data follows consistent schema.

Full CRUD: Creation, update, deletion of nodes and edges.

Pagination: Supports paged retrieval from hybrid search results.

Stats & Health: APIs expose vector/graph statistics and health.

APIs
POST /hybrid/nodes - Create a node (with validation)

GET /hybrid/nodes/:id - Fetch a node by ID

PUT /hybrid/nodes/:id - Update a node

DELETE /hybrid/nodes/:id - Delete a node and related edges

POST /hybrid/edges - Create typed relationship between nodes (with validation)

GET /hybrid/edges/:id - Get edge details

POST /hybrid/ingest - Intelligent ingest routing for text + graph data

POST /hybrid/search - Hybrid retrieval with vector + graph scoring + pagination

POST /hybrid/search/vector - Vector-only retrieval

GET /hybrid/search/graph - Graph traversal search

GET /hybrid/search/multi-hop - Multi-hop graph reasoning

GET /hybrid/stats - Stats and health of vector and graph stores

Installation and Setup
Prerequisites
Node.js 18+

Neo4j database instance accessible with credentials

Compatible embeddings API (e.g., OpenAI, or local embedding generator)