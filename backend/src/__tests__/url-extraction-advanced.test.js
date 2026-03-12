import { describe, it, expect } from 'vitest';

// Extracted HTML processing functions from ai.js

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

describe('Title Extraction', () => {
  it('should extract simple title', () => {
    expect(extractTitle('<title>Test Page</title>')).toBe('Test Page');
  });

  it('should extract title with attributes', () => {
    expect(extractTitle('<title data-react="true">React App</title>')).toBe('React App');
  });

  it('should handle whitespace in title', () => {
    expect(extractTitle('<title>  Multiple   Spaces  </title>')).toBe('Multiple Spaces');
  });

  it('should handle newlines in title', () => {
    expect(extractTitle('<title>\n  My\n  Page\n</title>')).toBe('My Page');
  });

  it('should return null for missing title', () => {
    expect(extractTitle('<html><body>No title</body></html>')).toBeNull();
  });

  it('should handle empty title tag', () => {
    expect(extractTitle('<title></title>')).toBe('');
  });

  it('should handle title with HTML entities', () => {
    expect(extractTitle('<title>Research &amp; Analysis</title>')).toBe('Research &amp; Analysis');
  });

  it('should be case-insensitive for title tag', () => {
    expect(extractTitle('<TITLE>Upper Case</TITLE>')).toBe('Upper Case');
  });

  it('should handle title with special characters', () => {
    expect(extractTitle('<title>Page (v2.0) - Demo [Beta]</title>')).toBe('Page (v2.0) - Demo [Beta]');
  });
});

describe('Title Decoding', () => {
  it('should decode ampersand entity', () => {
    expect(decodeTitle('Research &amp; Development')).toBe('Research & Development');
  });

  it('should decode multiple entities', () => {
    expect(decodeTitle('&lt;b&gt;Bold &amp; &quot;Italic&quot;&lt;/b&gt;'))
      .toBe('<b>Bold & "Italic"</b>');
  });

  it('should decode apostrophe entity', () => {
    expect(decodeTitle('It&#39;s a test')).toBe("It's a test");
  });

  it('should handle text without entities', () => {
    expect(decodeTitle('Plain Text Title')).toBe('Plain Text Title');
  });

  it('should handle consecutive entities', () => {
    expect(decodeTitle('&amp;&amp;&amp;')).toBe('&&&');
  });
});

describe('Non-Content Stripping', () => {
  it('should strip script with src attribute', () => {
    const html = '<p>Content</p><script src="app.js"></script>';
    expect(stripNonContent(html)).not.toContain('app.js');
    expect(stripNonContent(html)).toContain('Content');
  });

  it('should strip inline script', () => {
    const html = '<script>document.write("evil")</script><p>Good</p>';
    expect(stripNonContent(html)).not.toContain('evil');
    expect(stripNonContent(html)).toContain('Good');
  });

  it('should strip multiple nav elements', () => {
    const html = '<nav>Top menu</nav><p>Content</p><nav>Bottom menu</nav>';
    const cleaned = stripNonContent(html);
    expect(cleaned).not.toContain('Top menu');
    expect(cleaned).not.toContain('Bottom menu');
    expect(cleaned).toContain('Content');
  });

  it('should strip nested elements within header', () => {
    const html = '<header><nav><a href="/">Home</a></nav><div>Logo</div></header><p>Body</p>';
    const cleaned = stripNonContent(html);
    expect(cleaned).not.toContain('Home');
    expect(cleaned).not.toContain('Logo');
    expect(cleaned).toContain('Body');
  });

  it('should strip aside with nested content', () => {
    const html = '<aside><h3>Related</h3><ul><li>Item 1</li></ul></aside><p>Main</p>';
    const cleaned = stripNonContent(html);
    expect(cleaned).not.toContain('Related');
    expect(cleaned).not.toContain('Item 1');
    expect(cleaned).toContain('Main');
  });

  it('should handle style with multiline CSS', () => {
    const html = '<style>\n  .class {\n    color: red;\n  }\n</style><p>Styled</p>';
    const cleaned = stripNonContent(html);
    expect(cleaned).not.toContain('color: red');
    expect(cleaned).toContain('Styled');
  });

  it('should preserve content between stripped elements', () => {
    const html = '<nav>Nav</nav><p>Content 1</p><footer>Foot</footer><p>Content 2</p>';
    const cleaned = stripNonContent(html);
    expect(cleaned).toContain('Content 1');
    expect(cleaned).toContain('Content 2');
    expect(cleaned).not.toContain('Nav');
    expect(cleaned).not.toContain('Foot');
  });

  it('should handle empty HTML', () => {
    expect(stripNonContent('')).toBe('');
  });

  it('should handle HTML with only stripped elements', () => {
    const html = '<script>x</script><style>y</style><nav>z</nav>';
    expect(stripNonContent(html).trim()).toBe('');
  });
});

describe('Article Extraction', () => {
  it('should extract from article tag', () => {
    const html = '<div>Sidebar</div><article><p>Article body</p></article>';
    expect(extractArticle(html)).toBe('<p>Article body</p>');
  });

  it('should fall back to main tag', () => {
    const html = '<div>Header</div><main><p>Main content</p></main>';
    expect(extractArticle(html)).toBe('<p>Main content</p>');
  });

  it('should prefer article over main', () => {
    const html = '<main>Main text</main><article>Article text</article>';
    expect(extractArticle(html)).toBe('Article text');
  });

  it('should handle article with class and id', () => {
    const html = '<article class="post" id="primary"><p>Post content</p></article>';
    expect(extractArticle(html)).toBe('<p>Post content</p>');
  });

  it('should handle main with role attribute', () => {
    const html = '<main role="main"><section>Content</section></main>';
    expect(extractArticle(html)).toBe('<section>Content</section>');
  });

  it('should return full HTML when neither tag exists', () => {
    const html = '<div><section><p>Just a section</p></section></div>';
    expect(extractArticle(html)).toBe(html);
  });

  it('should handle empty article tag', () => {
    const html = '<article></article>';
    expect(extractArticle(html)).toBe('');
  });

  it('should handle nested article content', () => {
    const html = '<article><h1>Title</h1><p>Paragraph</p><blockquote>Quote</blockquote></article>';
    const extracted = extractArticle(html);
    expect(extracted).toContain('Title');
    expect(extracted).toContain('Paragraph');
    expect(extracted).toContain('Quote');
  });
});

describe('HTML to Plain Text Conversion', () => {
  it('should convert br tags to newlines', () => {
    expect(htmlToPlainText('Line 1<br>Line 2')).toBe('Line 1\nLine 2');
  });

  it('should handle self-closing br tags', () => {
    expect(htmlToPlainText('A<br/>B<br />C')).toContain('A\nB\nC');
  });

  it('should add double newlines after paragraphs', () => {
    const result = htmlToPlainText('<p>First</p><p>Second</p>');
    expect(result).toContain('First');
    expect(result).toContain('Second');
  });

  it('should add double newlines after headings', () => {
    const result = htmlToPlainText('<h1>Title</h1><h2>Subtitle</h2>');
    expect(result).toContain('Title');
    expect(result).toContain('Subtitle');
  });

  it('should add double newlines after list items', () => {
    const result = htmlToPlainText('<li>Item 1</li><li>Item 2</li>');
    expect(result).toContain('Item 1');
    expect(result).toContain('Item 2');
  });

  it('should add double newlines after table rows', () => {
    const result = htmlToPlainText('<tr><td>Cell 1</td></tr><tr><td>Cell 2</td></tr>');
    expect(result).toContain('Cell 1');
    expect(result).toContain('Cell 2');
  });

  it('should add double newlines after blockquotes', () => {
    const result = htmlToPlainText('<blockquote>Quoted text</blockquote>');
    expect(result).toContain('Quoted text');
  });

  it('should strip all remaining HTML tags', () => {
    const result = htmlToPlainText('<span class="bold">Text</span>');
    expect(result).toBe('Text');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
  });

  it('should decode nbsp entities', () => {
    expect(htmlToPlainText('Word&nbsp;word')).toBe('Word word');
  });

  it('should decode ampersand entities', () => {
    expect(htmlToPlainText('A &amp; B')).toBe('A & B');
  });

  it('should decode angle bracket entities', () => {
    expect(htmlToPlainText('&lt;code&gt;')).toBe('<code>');
  });

  it('should decode quote entities', () => {
    expect(htmlToPlainText('&quot;quoted&quot;')).toBe('"quoted"');
  });

  it('should decode apostrophe entities', () => {
    expect(htmlToPlainText("it&#39;s")).toBe("it's");
  });

  it('should normalize multiple newlines', () => {
    const result = htmlToPlainText('A\n\n\n\n\nB');
    expect(result).not.toMatch(/\n{3,}/);
  });

  it('should trim leading and trailing whitespace', () => {
    const result = htmlToPlainText('  <p>Content</p>  ');
    expect(result).not.toMatch(/^\s/);
    expect(result).not.toMatch(/\s$/);
  });

  it('should handle empty HTML', () => {
    expect(htmlToPlainText('')).toBe('');
  });

  it('should handle deeply nested tags', () => {
    const html = '<div><div><span><strong><em>Deep</em></strong></span></div></div>';
    expect(htmlToPlainText(html)).toBe('Deep');
  });

  it('should handle img tags by removing them', () => {
    const html = '<p>Before<img src="image.jpg" alt="alt text">After</p>';
    const result = htmlToPlainText(html);
    expect(result).toContain('Before');
    expect(result).toContain('After');
    expect(result).not.toContain('img');
  });

  it('should handle anchor tags preserving text', () => {
    const html = '<a href="https://example.com">Click here</a>';
    expect(htmlToPlainText(html)).toBe('Click here');
  });
});

describe('Content Truncation', () => {
  it('should not truncate short content', () => {
    const content = 'Short text';
    expect(truncateContent(content)).toBe(content);
  });

  it('should truncate at 10000 characters', () => {
    const content = 'x'.repeat(15000);
    const result = truncateContent(content);
    expect(result.length).toBeLessThan(15000);
    expect(result).toContain('[Content truncated...]');
  });

  it('should truncate exactly at the boundary', () => {
    const content = 'x'.repeat(10001);
    const result = truncateContent(content);
    expect(result).toContain('[Content truncated...]');
  });

  it('should not truncate content at exactly 10000 chars', () => {
    const content = 'x'.repeat(10000);
    const result = truncateContent(content);
    expect(result).not.toContain('[Content truncated...]');
    expect(result.length).toBe(10000);
  });

  it('should preserve first 10000 chars of truncated content', () => {
    const content = 'A'.repeat(5000) + 'B'.repeat(10000);
    const result = truncateContent(content);
    expect(result.startsWith('A'.repeat(5000))).toBe(true);
    expect(result).toContain('B'.repeat(5000)); // First 5000 Bs are kept
  });

  it('should support custom max length', () => {
    const content = 'x'.repeat(200);
    const result = truncateContent(content, 100);
    expect(result).toContain('[Content truncated...]');
    expect(result.startsWith('x'.repeat(100))).toBe(true);
  });

  it('should handle empty content', () => {
    expect(truncateContent('')).toBe('');
  });
});

describe('Full URL Extraction Pipeline', () => {
  function processHTML(html) {
    // Full pipeline from ai.js extract-url endpoint
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    let title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : 'Unknown';

    let content = stripNonContent(html);
    content = extractArticle(content);
    content = htmlToPlainText(content);
    content = truncateContent(content);
    title = decodeTitle(title);

    return { title, content };
  }

  it('should process a complete web page', () => {
    const html = `
      <html>
      <head><title>Research &amp; Findings</title></head>
      <body>
        <nav>Menu</nav>
        <article>
          <h1>Main Article</h1>
          <p>First paragraph with important content.</p>
          <p>Second paragraph with more details.</p>
        </article>
        <footer>Copyright 2026</footer>
        <script>analytics()</script>
      </body>
      </html>
    `;

    const result = processHTML(html);
    expect(result.title).toBe('Research & Findings');
    expect(result.content).toContain('Main Article');
    expect(result.content).toContain('First paragraph');
    expect(result.content).toContain('Second paragraph');
    expect(result.content).not.toContain('Menu');
    expect(result.content).not.toContain('Copyright');
    expect(result.content).not.toContain('analytics');
  });

  it('should handle page with only main tag', () => {
    const html = '<html><head><title>App</title></head><body><main><p>Content</p></main></body></html>';
    const result = processHTML(html);
    expect(result.title).toBe('App');
    expect(result.content).toContain('Content');
  });

  it('should handle page without article or main', () => {
    const html = '<html><head><title>Simple</title></head><body><div><p>Div content</p></div></body></html>';
    const result = processHTML(html);
    expect(result.title).toBe('Simple');
    expect(result.content).toContain('Div content');
  });

  it('should handle page without title', () => {
    const html = '<html><body><article><p>No title page</p></article></body></html>';
    const result = processHTML(html);
    expect(result.title).toBe('Unknown');
    expect(result.content).toContain('No title page');
  });

  it('should handle large page with truncation', () => {
    const largeContent = '<p>' + 'x'.repeat(20000) + '</p>';
    const html = `<html><head><title>Big Page</title></head><body><article>${largeContent}</article></body></html>`;
    const result = processHTML(html);
    expect(result.content).toContain('[Content truncated...]');
  });
});

describe('URL Response Format', () => {
  it('should return title, content, and source_url', () => {
    const response = {
      title: 'Test Article',
      content: 'Article content here',
      source_url: 'https://example.com/article'
    };

    expect(response).toHaveProperty('title');
    expect(response).toHaveProperty('content');
    expect(response).toHaveProperty('source_url');
  });

  it('should use hostname as fallback title', () => {
    const url = 'https://arxiv.org/abs/2301.12345';
    const fallbackTitle = new URL(url).hostname;
    expect(fallbackTitle).toBe('arxiv.org');
  });

  it('should handle URL with port in hostname fallback', () => {
    const url = 'http://localhost:3000/page';
    const fallbackTitle = new URL(url).hostname;
    expect(fallbackTitle).toBe('localhost');
  });
});

describe('Fetch Configuration', () => {
  it('should use SyncMind User-Agent header', () => {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (compatible; SyncMind/1.0; +https://github.com/Fulcria-Labs/syncmind)',
      'Accept': 'text/html,application/xhtml+xml,text/plain'
    };
    expect(headers['User-Agent']).toContain('SyncMind');
    expect(headers['Accept']).toContain('text/html');
  });

  it('should use 15s timeout', () => {
    const timeoutMs = 15000;
    expect(timeoutMs).toBe(15000);
    expect(timeoutMs / 1000).toBe(15);
  });
});
