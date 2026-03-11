import { describe, it, expect } from 'vitest';
import { extractKeywords, localSummary } from '../lib/localKeywords';

describe('extractKeywords', () => {
  it('returns empty array for empty input', () => {
    expect(extractKeywords('')).toEqual([]);
    expect(extractKeywords('   ')).toEqual([]);
  });

  it('returns empty array for very short text', () => {
    expect(extractKeywords('hello')).toEqual([]);
    expect(extractKeywords('short txt')).toEqual([]);
  });

  it('filters out stop words', () => {
    const text = 'the quick brown fox jumped over the lazy dog and the fox ran again';
    const keywords = extractKeywords(text);
    expect(keywords).not.toContain('the');
    expect(keywords).not.toContain('and');
    expect(keywords).not.toContain('over');
  });

  it('extracts repeated words as keywords', () => {
    const text = 'machine learning is transforming machine learning applications. machine learning models improve daily.';
    const keywords = extractKeywords(text);
    expect(keywords.some(k => k.includes('machine'))).toBe(true);
    expect(keywords.some(k => k.includes('learning'))).toBe(true);
  });

  it('boosts bigrams over unigrams', () => {
    const text = 'neural network architecture uses neural network layers. neural network training is key.';
    const keywords = extractKeywords(text);
    // "neural network" bigram should appear before individual words
    expect(keywords[0]).toBe('neural network');
  });

  it('respects maxKeywords parameter', () => {
    const text = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu. ' +
      'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu.';
    const keywords = extractKeywords(text, 3);
    expect(keywords.length).toBeLessThanOrEqual(3);
  });

  it('defaults to max 8 keywords', () => {
    const longText = Array(20).fill(
      'retrieval augmented generation embeddings vector database semantic search neural language model transformer architecture'
    ).join('. ');
    const keywords = extractKeywords(longText);
    expect(keywords.length).toBeLessThanOrEqual(8);
  });

  it('filters out pure numbers', () => {
    const text = 'in 2024 there were 500 models and 1000 parameters used across 200 experiments repeatedly';
    const keywords = extractKeywords(text);
    for (const k of keywords) {
      expect(k).not.toMatch(/^\d+$/);
    }
  });

  it('filters out words shorter than 3 characters', () => {
    const text = 'AI ML NLP are key terms in artificial intelligence research and development today';
    const keywords = extractKeywords(text);
    for (const k of keywords) {
      for (const word of k.split(' ')) {
        expect(word.length).toBeGreaterThan(2);
      }
    }
  });

  it('handles URL-like content gracefully', () => {
    const text = 'visit https://example.com/path for more info about machine learning research and machine learning tools';
    const keywords = extractKeywords(text);
    expect(keywords).not.toContain('https');
    expect(keywords).not.toContain('com');
    expect(keywords).not.toContain('www');
  });

  it('deduplicates bigram components', () => {
    const text = 'deep learning models use deep learning techniques for deep learning tasks. deep learning research advances.';
    const keywords = extractKeywords(text);
    // Should have "deep learning" bigram, not separate "deep" and "learning"
    const deepLearningCount = keywords.filter(k => k === 'deep learning').length;
    const deepAlone = keywords.filter(k => k === 'deep').length;
    const learningAlone = keywords.filter(k => k === 'learning').length;
    expect(deepLearningCount).toBe(1);
    expect(deepAlone).toBe(0);
    expect(learningAlone).toBe(0);
  });
});

describe('localSummary', () => {
  it('returns empty string for empty input', () => {
    expect(localSummary('')).toBe('');
    expect(localSummary(undefined as unknown as string)).toBe('');
  });

  it('extracts first meaningful sentences', () => {
    const text = 'This is the first important sentence about AI research. The second sentence provides more context. The third sentence adds detail.';
    const summary = localSummary(text, 2);
    expect(summary).toContain('first important sentence');
    expect(summary).toContain('second sentence');
  });

  it('filters out very short sentences', () => {
    const text = 'Short. Ok fine. This is a proper sentence with enough content to pass the filter. Another good sentence here with details.';
    const summary = localSummary(text, 2);
    expect(summary).not.toContain('Short.');
    expect(summary).not.toContain('Ok fine.');
  });

  it('handles newlines by treating them as sentence breaks', () => {
    const text = 'First paragraph with important content about research\nSecond paragraph with more details about the methodology';
    const summary = localSummary(text, 1);
    expect(summary.length).toBeGreaterThan(0);
  });

  it('defaults to 2 sentences', () => {
    const text = 'Sentence one is about machine learning advances. Sentence two discusses neural networks. Sentence three covers transformers.';
    const summary = localSummary(text);
    const sentences = summary.split(/(?<=[.!?])\s+/).filter(s => s.length > 0);
    expect(sentences.length).toBeLessThanOrEqual(2);
  });

  it('respects maxSentences parameter', () => {
    const text = 'First sentence about artificial intelligence. Second sentence about machine learning. Third sentence about deep learning.';
    const one = localSummary(text, 1);
    const three = localSummary(text, 3);
    expect(one.length).toBeLessThan(three.length);
  });

  it('filters out excessively long sentences', () => {
    const longSentence = 'Word '.repeat(200) + '.';
    const normalSentence = 'This is a normal research sentence about AI methodology.';
    const text = longSentence + ' ' + normalSentence;
    const summary = localSummary(text, 2);
    // The 1000-char sentence should be filtered, only normal one remains
    expect(summary).not.toContain('Word Word Word');
  });
});
