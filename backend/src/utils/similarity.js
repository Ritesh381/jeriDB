export function cosineSimilarity(vectorA, vectorB) {
  if (vectorA.length !== vectorB.length) {
    throw new Error('Vectors must have same dimension')
  }
  
  let dotProduct = 0
  let magnitudeA = 0
  let magnitudeB = 0
  
  for (let i = 0; i < vectorA.length; i++) {
    const a = vectorA[i]
    const b = vectorB[i]
    
    dotProduct += a * b
    magnitudeA += a * a
    magnitudeB += b * b
  }
  
  magnitudeA = Math.sqrt(magnitudeA)
  magnitudeB = Math.sqrt(magnitudeB)
  
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0
  }
  
  return dotProduct / (magnitudeA * magnitudeB)
}

export function batchSimilarity(queryVector, vectorList) {
  return vectorList.map((vec, idx) => ({
    index: idx,
    similarity: cosineSimilarity(queryVector, vec)
  }))
}

export function distanceToSimilarity(distance, maxDistance = 1) {
  return Math.max(0, 1 - distance)
}

export function testCosineSimilarity() {
  const vec1 = [0.9, 0.1, 0.0]
  const vec2 = [0.89, 0.11, 0.01]
  console.log('Similar:', cosineSimilarity(vec1, vec2))
  
  const vec3 = [1, 0, 0]
  const vec4 = [0, 1, 0]
  console.log('Perpendicular:', cosineSimilarity(vec3, vec4))
  
  const vec5 = [1, 0, 0]
  const vec6 = [-1, 0, 0]
  console.log('Opposite:', cosineSimilarity(vec5, vec6))
}
