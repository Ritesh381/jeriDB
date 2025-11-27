import React, { useState } from 'react'
import axios from 'axios'
import { Search, Database, Link, Zap } from 'lucide-react'

const API_BASE = 'http://localhost:3000/hybrid'

function App() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('hybrid')

  const testDemo = async () => {
    setLoading(true)
    try {
      await axios.post(`${API_BASE}/nodes`, {
        id: 'ai_healthcare',
        text: 'AI revolutionizing healthcare diagnostics ML cancer detection',
        metadata: { type: 'healthcare_ai', tags: ['AI', 'healthcare'] }
      })
      await axios.post(`${API_BASE}/nodes`, {
        id: 'cancer_ml',
        text: 'Cancer detection using machine learning algorithms',
        metadata: { type: 'medical_ml', tags: ['ML', 'cancer'] }
      })
      await axios.post(`${API_BASE}/edges`, {
        source: 'ai_healthcare', 
        target: 'cancer_ml', 
        type: 'USES', 
        weight: 0.9
      })
      
      const res = await axios.post(`${API_BASE}/search`, {
        query: 'AI healthcare cancer diagnostics',
        type: 'hybrid'
      })
      setResults(res.data)
      setQuery('AI healthcare cancer diagnostics')
    } catch (error) {
      console.error(error)
    }
    setLoading(false)
  }

  const search = async () => {
    setLoading(true)
    try {
      const res = await axios.post(`${API_BASE}/search`, {
        query, 
        type: activeTab, 
        top_k: 5
      })
      setResults(res.data)
    } catch (error) {
      console.error(error)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent mb-4">
            Vector + Graph Hybrid DB
          </h1>
          <p className="text-xl text-purple-100 mb-8">
            LanceDB + Neo4j → AI Retrieval Revolution
          </p>
          <button
            onClick={testDemo}
            disabled={loading}
            className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 px-8 py-4 rounded-xl font-bold text-lg flex items-center mx-auto gap-2 shadow-2xl hover:shadow-emerald-500/25 transition-all disabled:opacity-50"
          >
            <Zap size={24} />
            Run Hackathon Demo
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 border border-white/20">
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <Search size={28} />
              Hybrid Search
            </h3>
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              className="w-full p-3 bg-white/20 rounded-xl border border-white/30 text-white mb-4"
            >
              <option value="hybrid">Hybrid (Vector + Graph)</option>
              <option value="vector_only">Vector Only</option>
            </select>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="AI healthcare cancer diagnostics..."
              className="w-full p-4 bg-white/20 rounded-xl border border-white/30 text-white placeholder-purple-200 mb-4 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={search}
              disabled={loading || !query}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 px-6 py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Search size={20} />
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>

          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 border border-white/20">
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <Database size={28} />
              Stats
            </h3>
            <button
              onClick={async () => {
                const res = await axios.get(`${API_BASE}/stats`)
                setResults({ stats: res.data })
              }}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 px-6 py-3 rounded-xl font-bold text-white mb-4"
            >
              Refresh Stats
            </button>
          </div>
        </div>

        {results.results && results.results.length > 0 && (
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 border border-white/20">
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <Link size={28} />
              Results ({results.graph_boosts || 0} Graph Boosts)
            </h3>
            <div className="space-y-4">
              {results.results.map((r, i) => (
                <div key={i} className="p-6 bg-white/20 rounded-xl border border-white/30">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-lg text-white">#{r.rank}</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                      r.hybrid_score > 0.5 ? 'bg-emerald-500/20 text-emerald-200' :
                      r.hybrid_score > 0 ? 'bg-yellow-500/20 text-yellow-200' :
                      'bg-red-500/20 text-red-200'
                    }`}>
                      {r.hybrid_score?.toFixed(3) || r.similarity?.toFixed(3)}
                    </span>
                  </div>
                  <p className="text-gray-200 mb-3">{r.text}</p>
                  <div className="text-sm text-purple-200">
                    ID:{' '}
                    <code className="bg-purple-900/50 px-2 py-1 rounded">
                      {r.docId}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {results.stats && (
          <div className="grid md:grid-cols-2 gap-6 mt-8">
            <div className="bg-green-500/20 backdrop-blur-xl rounded-2xl p-6 border border-green-500/30 text-center">
              <h4 className="text-xl font-bold text-green-100 mb-2">🧠 VectorDB (LanceDB)</h4>
              <p className="text-3xl font-bold text-green-200">
                {results.stats.vector.totalDocuments}
              </p>
              <p className="text-green-100">Documents</p>
            </div>
            <div className="bg-purple-500/20 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/30 text-center">
              <h4 className="text-xl font-bold text-purple-100 mb-2">🌐 GraphDB (Neo4j)</h4>
              <p className="text-3xl font-bold text-purple-200">
                {results.stats.graph.totalNodes}
              </p>
              <p className="text-purple-100">{results.stats.graph.totalEdges} edges</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
