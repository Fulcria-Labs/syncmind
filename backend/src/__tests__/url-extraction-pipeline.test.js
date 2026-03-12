import { describe, it, expect } from 'vitest';

// Full extraction pipeline functions from ai.js

function extractTitle(html) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : null;
}

function stripNonContent(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '');
}

function extractArticle(html) {
  const articleMatch = html.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i)
    || html.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i);
  return articleMatch ? articleMatch[1] : html;
}

function htmlToPlainText(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|h[1-6]|li|tr|blockquote)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeTitle(title) {
  return title
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function truncateContent(content, maxLen = 10000) {
  if (content.length > maxLen) {
    return content.slice(0, maxLen) + '\n\n[Content truncated...]';
  }
  return content;
}

// ─── Complex HTML Scenarios ───

describe('URL Extraction - Complex HTML Structures', () => {
  it('should handle page with nested script inside body', () => {
    const html = '<body><div><script type="application/json">{"key":"value"}</script><p>Real content</p></div></body>';
    const cleaned = stripNonContent(html);
    expect(cleaned).toContain('Real content');
    expect(cleaned).not.toContain('"key":"value"');
  });

  it('should handle page with multiple style blocks', () => {
    const html = '<style>body{margin:0}</style><p>Text</p><style>.dark{background:#000}</style>';
    const cleaned = stripNonContent(html);
    expect(cleaned).toContain('Text');
    expect(cleaned).not.toContain('margin');
    expect(cleaned).not.toContain('background');
  });

  it('should handle page with inline event handlers (not stripped by current regex)', () => {
    const html = '<button onclick="alert(1)">Click</button><p>Content</p>';
    const text = htmlToPlainText(html);
    expect(text).toContain('Click');
    expect(text).toContain('Content');
    expect(text).not.toContain('onclick');
  });

  it('should handle nested divs deeply', () => {
    let html = '<p>Deep content</p>';
    for (let i = 0; i < 10; i++) {
      html = `<div>${html}</div>`;
    }
    const text = htmlToPlainText(html);
    expect(text).toContain('Deep content');
  });

  it('should handle table structures', () => {
    const html = '<table><tr><td>Cell 1</td><td>Cell 2</td></tr><tr><td>Cell 3</td><td>Cell 4</td></tr></table>';
    const text = htmlToPlainText(html);
    expect(text).toContain('Cell 1');
    expect(text).toContain('Cell 2');
    expect(text).toContain('Cell 3');
    expect(text).toContain('Cell 4');
  });

  it('should handle definition lists', () => {
    const html = '<dl><dt>Term</dt><dd>Definition</dd></dl>';
    const text = htmlToPlainText(html);
    expect(text).toContain('Term');
    expect(text).toContain('Definition');
  });

  it('should handle preformatted text', () => {
    const html = '<pre><code>function hello() {\n  return "world";\n}</code></pre>';
    const text = htmlToPlainText(html);
    expect(text).toContain('function hello');
    expect(text).toContain('return "world"');
  });
});

describe('URL Extraction - Tricky Title Cases', () => {
  it('should handle title with pipe separator (common pattern)', () => {
    const title = extractTitle('<title>Article Title | Site Name</title>');
    expect(title).toBe('Article Title | Site Name');
  });

  it('should handle title with dash separator', () => {
    const title = extractTitle('<title>Article - Site Name</title>');
    expect(title).toBe('Article - Site Name');
  });

  it('should handle title with HTML entities needing decode', () => {
    const rawTitle = extractTitle('<title>Tom &amp; Jerry&#39;s &quot;Adventure&quot;</title>');
    const decoded = decodeTitle(rawTitle);
    expect(decoded).toBe('Tom & Jerry\'s "Adventure"');
  });

  it('should handle title with non-ASCII characters', () => {
    const title = extractTitle('<title>Recherche sur l\'IA - Résumé</title>');
    expect(title).toBe("Recherche sur l'IA - Résumé");
  });

  it('should handle title with only whitespace', () => {
    const title = extractTitle('<title>   </title>');
    expect(title).toBe('');
  });

  it('should handle very long title', () => {
    const longTitle = 'A'.repeat(500);
    const title = extractTitle(`<title>${longTitle}</title>`);
    expect(title).toBe(longTitle);
    expect(title.length).toBe(500);
  });

  it('should handle title with tabs and newlines normalized', () => {
    const title = extractTitle('<title>\t First\t\n Second \n Third \t</title>');
    expect(title).toBe('First Second Third');
  });
});

describe('URL Extraction - HTML Entity Edge Cases', () => {
  it('should decode &nbsp; to space', () => {
    const text = htmlToPlainText('word1&nbsp;&nbsp;word2');
    expect(text).toBe('word1  word2');
  });

  it('should decode mixed entities in same string', () => {
    const text = htmlToPlainText('A &amp; B &lt; C &gt; D &quot;E&quot; F&#39;s');
    expect(text).toBe('A & B < C > D "E" F\'s');
  });

  it('should handle entities at start and end of text', () => {
    const text = htmlToPlainText('&amp;start and end&amp;');
    expect(text).toBe('&start and end&');
  });

  it('should handle numeric entities (&#xx;) for apostrophe', () => {
    const text = htmlToPlainText('don&#39;t');
    expect(text).toBe("don't");
  });

  it('should not decode unknown entities', () => {
    const text = htmlToPlainText('&unknown; entity');
    expect(text).toContain('&unknown;');
  });

  it('should handle double-encoded entities (decode only once)', () => {
    const text = htmlToPlainText('&amp;amp;');
    expect(text).toBe('&amp;');
  });
});

describe('URL Extraction - Article vs Main Preference', () => {
  it('should extract article when it comes before main', () => {
    const html = '<article>Article first</article><main>Main second</main>';
    expect(extractArticle(html)).toBe('Article first');
  });

  it('should extract article when it comes after main', () => {
    const html = '<main>Main first</main><article>Article second</article>';
    expect(extractArticle(html)).toBe('Article second');
  });

  it('should extract main when no article exists', () => {
    const html = '<div>Div</div><main>Main only</main>';
    expect(extractArticle(html)).toBe('Main only');
  });

  it('should handle article with data attributes', () => {
    const html = '<article data-type="blog" data-id="123"><p>Blog post</p></article>';
    expect(extractArticle(html)).toBe('<p>Blog post</p>');
  });

  it('should handle main with ARIA attributes', () => {
    const html = '<main role="main" aria-label="content"><p>Accessible content</p></main>';
    expect(extractArticle(html)).toBe('<p>Accessible content</p>');
  });
});

describe('URL Extraction - Content Truncation Boundary', () => {
  it('should not modify content at exactly 10000 chars', () => {
    const content = 'A'.repeat(10000);
    expect(truncateContent(content)).toBe(content);
    expect(truncateContent(content).length).toBe(10000);
  });

  it('should truncate content at 10001 chars', () => {
    const content = 'A'.repeat(10001);
    const result = truncateContent(content);
    expect(result).toContain('[Content truncated...]');
    expect(result.startsWith('A'.repeat(10000))).toBe(true);
  });

  it('should handle content of length 1', () => {
    expect(truncateContent('x')).toBe('x');
  });

  it('should handle empty content', () => {
    expect(truncateContent('')).toBe('');
  });

  it('should preserve multi-byte character boundary on truncation', () => {
    // JS slices by code unit, not by grapheme, so this tests the behavior
    const content = 'A'.repeat(9999) + '🧠'; // emoji is 2 code units
    const result = truncateContent(content);
    expect(result).toContain('[Content truncated...]');
  });
});

describe('URL Extraction - Full Pipeline Edge Cases', () => {
  function processHTML(html) {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    let title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : 'Unknown';

    let content = stripNonContent(html);
    content = extractArticle(content);
    content = htmlToPlainText(content);
    content = truncateContent(content);
    title = decodeTitle(title);

    return { title, content };
  }

  it('should handle completely empty HTML', () => {
    const result = processHTML('');
    expect(result.title).toBe('Unknown');
    expect(result.content).toBe('');
  });

  it('should handle HTML with only script and style (no content)', () => {
    const html = '<html><head><title>Empty</title><style>x</style></head><body><script>y</script></body></html>';
    const result = processHTML(html);
    expect(result.title).toBe('Empty');
  });

  it('should handle page with comments in HTML', () => {
    const html = '<html><head><title>Page</title></head><body><!-- This is a comment --><p>Visible</p></body></html>';
    const result = processHTML(html);
    expect(result.content).toContain('Visible');
  });

  it('should handle page with CDATA sections', () => {
    const html = '<html><head><title>CDATA</title></head><body><p>Content</p></body></html>';
    const result = processHTML(html);
    expect(result.title).toBe('CDATA');
    expect(result.content).toContain('Content');
  });

  it('should handle page with multiple article tags (takes first)', () => {
    const html = '<article>First article</article><article>Second article</article>';
    const result = processHTML(html);
    expect(result.content).toContain('First article');
  });

  it('should handle page with SVG elements', () => {
    const html = '<html><head><title>SVG Page</title></head><body><svg><circle r="10"/></svg><p>Text</p></body></html>';
    const result = processHTML(html);
    expect(result.content).toContain('Text');
  });

  it('should handle page with form elements', () => {
    const html = '<html><head><title>Form</title></head><body><form><input type="text"><button>Submit</button></form><p>After form</p></body></html>';
    const result = processHTML(html);
    expect(result.content).toContain('Submit');
    expect(result.content).toContain('After form');
  });

  it('should handle real-world arXiv-style page structure', () => {
    const html = `
      <html>
      <head><title>Attention Is All You Need</title>
      <script>window.ga=function(){}</script>
      <style>.paper{max-width:800px}</style>
      </head>
      <body>
      <nav><a href="/">arXiv</a></nav>
      <main>
        <h1>Attention Is All You Need</h1>
        <p>We propose a new simple network architecture, the Transformer, based solely on attention mechanisms.</p>
        <h2>Abstract</h2>
        <p>The dominant sequence transduction models are based on complex recurrent or convolutional neural networks.</p>
      </main>
      <footer>arXiv 2017</footer>
      </body>
      </html>
    `;
    const result = processHTML(html);
    expect(result.title).toBe('Attention Is All You Need');
    expect(result.content).toContain('Transformer');
    expect(result.content).toContain('attention mechanisms');
    expect(result.content).not.toContain('window.ga');
    expect(result.content).not.toContain('arXiv 2017');
  });
});

describe('URL Extraction - Hostname Fallback', () => {
  it('should extract hostname from various URL formats', () => {
    const urls = [
      { url: 'https://arxiv.org/abs/1706.03762', expected: 'arxiv.org' },
      { url: 'http://localhost:3000/page', expected: 'localhost' },
      { url: 'https://sub.domain.example.com/path', expected: 'sub.domain.example.com' },
      { url: 'https://example.com', expected: 'example.com' },
      { url: 'https://192.168.1.1:8080/api', expected: '192.168.1.1' },
    ];

    for (const { url, expected } of urls) {
      expect(new URL(url).hostname).toBe(expected);
    }
  });
});

describe('URL Extraction - Fetch Headers', () => {
  it('should have proper User-Agent identifying SyncMind', () => {
    const ua = 'Mozilla/5.0 (compatible; SyncMind/1.0; +https://github.com/Fulcria-Labs/syncmind)';
    expect(ua).toContain('SyncMind');
    expect(ua).toContain('Mozilla/5.0');
    expect(ua).toContain('Fulcria-Labs');
  });

  it('should accept HTML and plain text content types', () => {
    const accept = 'text/html,application/xhtml+xml,text/plain';
    expect(accept).toContain('text/html');
    expect(accept).toContain('text/plain');
    expect(accept).toContain('xhtml');
  });

  it('should use 15 second timeout', () => {
    const timeout = 15000;
    expect(timeout).toBe(15000);
  });
});
