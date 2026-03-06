/**
 * Local keyword extraction - runs entirely in the browser.
 * No API needed. Works offline. Demonstrates local-first AI capabilities.
 * Uses TF-IDF-like scoring with stop word filtering.
 */

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall',
  'can', 'need', 'dare', 'ought', 'used', 'it', 'its', 'this', 'that', 'these', 'those',
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'they',
  'them', 'their', 'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how', 'all',
  'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'not',
  'only', 'same', 'so', 'than', 'too', 'very', 'just', 'about', 'above', 'after', 'again',
  'also', 'any', 'as', 'because', 'before', 'between', 'but', 'down', 'during', 'even',
  'if', 'into', 'like', 'new', 'now', 'off', 'old', 'one', 'out', 'over', 'own', 'part',
  'per', 'still', 'then', 'there', 'through', 'under', 'up', 'use', 'using', 'well',
  'while', 'work', 'get', 'got', 'make', 'made', 'much', 'many', 'way', 'see', 'see',
  'set', 'take', 'http', 'https', 'www', 'com', 'org', 'net', 'html'
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
}

/**
 * Extract top keywords from text using frequency analysis.
 * Boosts multi-word phrases (bigrams) found in the text.
 */
export function extractKeywords(text: string, maxKeywords = 8): string[] {
  if (!text || text.trim().length < 10) return [];

  const words = tokenize(text);
  if (words.length === 0) return [];

  // Unigram frequency
  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  // Bigram frequency (boost phrases)
  const bigramFreq = new Map<string, number>();
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    bigramFreq.set(bigram, (bigramFreq.get(bigram) || 0) + 1);
  }

  // Combine: unigrams with count >= 2 + bigrams with count >= 2
  const candidates: Array<{ term: string; score: number }> = [];

  for (const [word, count] of freq) {
    if (count >= 2) {
      candidates.push({ term: word, score: count });
    }
  }

  for (const [bigram, count] of bigramFreq) {
    if (count >= 2) {
      candidates.push({ term: bigram, score: count * 1.5 }); // boost phrases
    }
  }

  // If not enough from frequency, add top single-occurrence words by position (earlier = more important)
  if (candidates.length < maxKeywords) {
    const seen = new Set(candidates.map(c => c.term));
    const positional = words
      .filter((w, i) => !seen.has(w) && i < words.length * 0.3) // first 30% of text
      .slice(0, maxKeywords);
    for (const w of positional) {
      if (!seen.has(w)) {
        candidates.push({ term: w, score: 1 });
        seen.add(w);
      }
    }
  }

  // Sort by score descending, return top N
  candidates.sort((a, b) => b.score - a.score);

  // Deduplicate: if a bigram contains a unigram, prefer the bigram
  const result: string[] = [];
  const used = new Set<string>();

  for (const c of candidates) {
    if (result.length >= maxKeywords) break;
    const parts = c.term.split(' ');
    if (parts.length === 2) {
      // Bigram: add it, mark its words as used
      result.push(c.term);
      used.add(parts[0]);
      used.add(parts[1]);
    } else if (!used.has(c.term)) {
      result.push(c.term);
      used.add(c.term);
    }
  }

  return result;
}

/**
 * Generate a simple local summary (first meaningful sentences).
 * Works offline - no AI needed.
 */
export function localSummary(text: string, maxSentences = 2): string {
  if (!text) return '';

  const sentences = text
    .replace(/\n+/g, '. ')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 500);

  return sentences.slice(0, maxSentences).join(' ');
}
