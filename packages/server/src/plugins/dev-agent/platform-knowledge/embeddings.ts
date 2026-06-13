import { embedText } from '../ollama-client.js'

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom ? dot / denom : 0
}

export async function embedWithFallback(text: string): Promise<number[]> {
  try {
    return await embedText(text)
  } catch {
    return keywordEmbedding(text)
  }
}

function keywordEmbedding(text: string, dims = 128): number[] {
  const vec = new Array(dims).fill(0)
  const words = text.toLowerCase().split(/\W+/).filter(Boolean)
  for (const w of words) {
    let h = 0
    for (let i = 0; i < w.length; i++) h = (h * 31 + w.charCodeAt(i)) % dims
    vec[h] += 1
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1
  return vec.map(v => v / norm)
}
