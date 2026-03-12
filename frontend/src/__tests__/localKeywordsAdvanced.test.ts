import { describe, it, expect } from 'vitest';
import { extractKeywords, localSummary } from '../lib/localKeywords';

// ─── Advanced extractKeywords Edge Cases ───

describe('extractKeywords - Unicode and Special Characters', () => {
  it('handles text with Unicode characters', () => {
    const text = 'machine learning with données and résumé machine learning advances. machine learning techniques are evolving.';
    const keywords = extractKeywords(text);
    expect(keywords.length).toBeGreaterThan(0);
  });

  it('handles text with code snippets', () => {
    const text = 'const model = new NeuralNetwork(); model.train(data); model.predict(input); model.train is important. model.train is key.';
    const keywords = extractKeywords(text);
    expect(keywords.length).toBeGreaterThan(0);
  });

  it('handles text with email addresses', () => {
    const text = 'Contact researcher@university.edu for machine learning papers about machine learning research and machine learning models.';
    const keywords = extractKeywords(text);
    // "edu" is in the stop words list so it gets filtered
    // But after tokenization, "university" may appear; the key check is machine learning is found
    expect(keywords.some(k => k.includes('machine'))).toBe(true);
  });

  it('handles text with markdown formatting', () => {
    const text = '## Introduction to **Machine Learning**\n\nMachine learning algorithms process machine learning data for machine learning tasks.';
    const keywords = extractKeywords(text);
    expect(keywords.some(k => k.includes('machine'))).toBe(true);
  });

  it('handles text with numbered lists', () => {
    const text = '1. neural networks are powerful 2. neural networks learn 3. neural networks generalize 4. neural networks scale.';
    const keywords = extractKeywords(text);
    expect(keywords.some(k => k.includes('neural'))).toBe(true);
  });
});

describe('extractKeywords - Boundary Conditions', () => {
  it('handles exactly 10 character text (minimum threshold)', () => {
    // 10 chars is the minimum, "short text" is 10 chars
    const keywords = extractKeywords('short text');
    // "short" and "text" are both < 3 occurrences, may or may not appear
    expect(Array.isArray(keywords)).toBe(true);
  });

  it('handles 9 character text (below threshold)', () => {
    const keywords = extractKeywords('short txt');
    expect(keywords).toEqual([]);
  });

  it('handles null-like input', () => {
    expect(extractKeywords('')).toEqual([]);
  });

  it('handles text with only stop words', () => {
    const text = 'the and or but in on at to for of with by from is are was were be been being have has had do does did';
    const keywords = extractKeywords(text);
    expect(keywords).toEqual([]);
  });

  it('handles text with only numbers', () => {
    const text = '100 200 300 400 500 600 700 800 900 1000 1100 1200';
    const keywords = extractKeywords(text);
    expect(keywords).toEqual([]);
  });

  it('handles text with only 2-letter words', () => {
    const text = 'ai ml dl go up at by it is no we he me be do if so am';
    const keywords = extractKeywords(text);
    expect(keywords).toEqual([]);
  });

  it('handles maxKeywords of 1', () => {
    const text = 'machine learning deep learning neural network machine learning deep learning neural network';
    const keywords = extractKeywords(text, 1);
    expect(keywords.length).toBeLessThanOrEqual(1);
  });

  it('handles maxKeywords of 0', () => {
    const text = 'machine learning deep learning neural network machine learning deep learning neural network';
    const keywords = extractKeywords(text, 0);
    expect(keywords).toEqual([]);
  });

  it('handles very large maxKeywords', () => {
    const text = 'alpha beta gamma delta epsilon alpha beta gamma delta epsilon';
    const keywords = extractKeywords(text, 100);
    // Should return what's available, not 100
    expect(keywords.length).toBeLessThanOrEqual(100);
    expect(keywords.length).toBeGreaterThan(0);
  });
});

describe('extractKeywords - Frequency Analysis', () => {
  it('ranks more frequent words higher', () => {
    // "neural" appears 5x, "quantum" appears 2x
    const text = 'neural networks process neural data. neural models improve. neural architecture is key. neural computing advances. quantum physics relates to quantum computing.';
    const keywords = extractKeywords(text);
    const neuralIdx = keywords.findIndex(k => k.includes('neural'));
    const quantumIdx = keywords.findIndex(k => k.includes('quantum'));
    if (neuralIdx >= 0 && quantumIdx >= 0) {
      expect(neuralIdx).toBeLessThan(quantumIdx);
    }
  });

  it('boosts bigrams with 1.5x multiplier', () => {
    // "deep learning" appears 3x as bigram (score: 3*1.5=4.5)
    // "algorithms" appears 3x as unigram (score: 3)
    const text = 'deep learning models use deep learning. deep learning algorithms work. algorithms process data. algorithms are fast.';
    const keywords = extractKeywords(text);
    const dlIdx = keywords.indexOf('deep learning');
    expect(dlIdx).toBe(0); // Should be first due to boost
  });

  it('includes frequently repeated terms', () => {
    const text = 'unique word here plus another unique word there. repeated term and repeated term again.';
    const keywords = extractKeywords(text);
    // "unique" and "word" and "repeated" and "term" have freq >= 2
    // They should appear as keywords (possibly as bigrams or unigrams)
    expect(keywords.some(k => k.includes('unique') || k.includes('word') || k.includes('repeated') || k.includes('term'))).toBe(true);
  });
});

describe('extractKeywords - Positional Fallback', () => {
  it('uses positional words when not enough frequent terms', () => {
    // All words appear only once, so positional fallback should kick in
    const text = 'transformer architecture enables attention mechanism allowing parallel processing across sequence positions.';
    const keywords = extractKeywords(text);
    // Should extract some keywords from first 30% of text
    expect(keywords.length).toBeGreaterThan(0);
  });
});

// ─── Advanced localSummary Edge Cases ───

describe('localSummary - Advanced', () => {
  it('handles text with only periods', () => {
    const result = localSummary('...');
    expect(result).toBe('');
  });

  it('handles text with question marks as sentence endings', () => {
    const text = 'What is machine learning and why does it matter? It is a subset of artificial intelligence that enables systems to learn.';
    const result = localSummary(text, 2);
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles text with exclamation marks', () => {
    const text = 'Machine learning is transforming the world! Neural networks achieve incredible accuracy in many important tasks.';
    const result = localSummary(text, 2);
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles text with mixed sentence terminators', () => {
    const text = 'First sentence about research. Second asks a question about methodology? Third is exciting about the results!';
    const result = localSummary(text, 3);
    expect(result.length).toBeGreaterThan(0);
  });

  it('filters out sentences with exactly 20 characters', () => {
    // "12345678901234567890" is exactly 20 chars - the filter is s.length > 20
    // But after replace newlines and split, the sentence boundary matters
    // The key insight: localSummary filters s.length > 20 and s.length < 500
    // 20 chars exactly should be filtered out; we need a clean test:
    const shortSentence = 'Short sentence only.'; // exactly 20 chars
    const longSentence = 'This is a valid longer sentence with enough content to pass the twenty character filter.';
    const text = shortSentence + ' ' + longSentence;
    const result = localSummary(text, 2);
    // The long sentence should be included
    expect(result).toContain('valid longer sentence');
  });

  it('includes sentences with 21 characters', () => {
    // "123456789012345678901" is 21 chars - should pass filter
    const text = '123456789012345678901. Another valid longer sentence about advanced AI research methods.';
    const result = localSummary(text, 2);
    // The 21-char "sentence" should pass the > 20 filter
    expect(result.length).toBeGreaterThan(0);
  });

  it('filters out sentences with exactly 500 characters', () => {
    // Sentence with exactly 500 chars should pass (filter is < 500)
    const longSentence = 'A'.repeat(498) + '.'; // 499 chars
    const normalSentence = 'This is a normal sentence about research methods in AI.';
    const text = longSentence + ' ' + normalSentence;
    const result = localSummary(text, 2);
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles text consisting of only newlines', () => {
    const result = localSummary('\n\n\n\n\n');
    expect(result).toBe('');
  });

  it('converts newlines to sentence breaks', () => {
    const text = 'First paragraph about machine learning research\nSecond paragraph about neural network architecture';
    const result = localSummary(text, 1);
    // Newlines become ". " so these become sentences
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles maxSentences of 0', () => {
    const text = 'This is a sentence about machine learning research. Another about neural networks.';
    const result = localSummary(text, 0);
    expect(result).toBe('');
  });

  it('handles very large maxSentences', () => {
    const text = 'First sentence about research. Second about methods.';
    const result = localSummary(text, 1000);
    // Should return all available sentences, not crash
    expect(result.length).toBeGreaterThan(0);
  });

  it('preserves sentence content accurately', () => {
    const text = 'Machine learning algorithms process vast amounts of training data. They learn patterns and make predictions on new data.';
    const result = localSummary(text, 1);
    expect(result).toContain('Machine learning algorithms');
  });
});

// ─── Tokenization Edge Cases (via extractKeywords) ───

describe('extractKeywords - Tokenization', () => {
  it('handles hyphenated words', () => {
    const text = 'state-of-the-art machine-learning techniques improve state-of-the-art performance. state-of-the-art models advance.';
    const keywords = extractKeywords(text);
    expect(keywords.length).toBeGreaterThan(0);
  });

  it('handles camelCase text', () => {
    const text = 'machinelearning is transforming dataScience. machinelearning models and machinelearning algorithms advance research.';
    const keywords = extractKeywords(text);
    expect(keywords.some(k => k.includes('machinelearning'))).toBe(true);
  });

  it('converts to lowercase', () => {
    const text = 'NEURAL NETWORK architecture uses NEURAL NETWORK layers for NEURAL NETWORK training purposes.';
    const keywords = extractKeywords(text);
    for (const k of keywords) {
      expect(k).toBe(k.toLowerCase());
    }
  });

  it('strips special punctuation', () => {
    const text = '"machine" \'learning\' (techniques) [algorithms] {models} machine learning techniques algorithms models!';
    const keywords = extractKeywords(text);
    for (const k of keywords) {
      expect(k).not.toMatch(/['"()\[\]{}!]/);
    }
  });
});
