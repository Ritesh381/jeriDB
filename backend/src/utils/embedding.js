export function generateMockEmbedding(text, dimensions = 384) {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  
  const embedding = []
  for (let i = 0; i < dimensions; i++) {
    const angle = (hash + i * 12345) % (2 * Math.PI)
    const value = Math.sin(angle) * 0.5 + 0.5
    embedding.push(value)
  }
  
  return embedding
}

let embeddingModel = null

export async function initializeRealEmbeddings() {
  try {
    const { pipeline } = await import('@xenova/transformers')
    console.log('Loading embedding model...')
    embeddingModel = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    )
    console.log('Embedding model loaded')
  } catch (error) {
    console.warn('Real embeddings not available, using mock')
    embeddingModel = null
  }
}

export async function generateRealEmbedding(text) {
  if (!embeddingModel) {
    return generateMockEmbedding(text)
  }
  
  try {
    const result = await embeddingModel(text, {
      pooling: 'mean',
      normalize: true
    })
    return Array.from(result.data)
  } catch (error) {
    console.warn('Error generating real embedding, falling back to mock')
    return generateMockEmbedding(text)
  }
}

export async function generateEmbedding(text, useReal = false) {
  if (useReal && embeddingModel) {
    return await generateRealEmbedding(text)
  }
  return generateMockEmbedding(text)
}

export function getEmbeddingDimensions() {
  return 384
}
