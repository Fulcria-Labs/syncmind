import { describe, it, expect } from 'vitest';

// ─── Extract and test pure logic from KnowledgeGraph.tsx ───

const TAG_COLORS: Record<string, string> = {
  'ai': '#8b5cf6',
  'machine-learning': '#8b5cf6',
  'security': '#ef4444',
  'web': '#3b82f6',
  'data': '#10b981',
  'research': '#f59e0b',
  'science': '#06b6d4',
  'default': '#6b7280',
};

function getNodeColor(tags: string): string {
  if (!tags) return TAG_COLORS.default;
  const tagList = tags.toLowerCase().split(',').map(t => t.trim());
  for (const tag of tagList) {
    for (const [key, color] of Object.entries(TAG_COLORS)) {
      if (tag.includes(key)) return color;
    }
  }
  return TAG_COLORS.default;
}

// ─── Node Color Logic ───

describe('KnowledgeGraph - getNodeColor', () => {
  it('should return purple for AI-related tags', () => {
    expect(getNodeColor('ai,research')).toBe('#8b5cf6');
    expect(getNodeColor('machine-learning,deep-learning')).toBe('#8b5cf6');
  });

  it('should return red for security tags', () => {
    expect(getNodeColor('security,web')).toBe('#ef4444');
  });

  it('should return blue for web tags', () => {
    expect(getNodeColor('web,frontend')).toBe('#3b82f6');
  });

  it('should return green for data tags', () => {
    expect(getNodeColor('data,analytics')).toBe('#10b981');
  });

  it('should return yellow for research tags', () => {
    expect(getNodeColor('research,paper')).toBe('#f59e0b');
  });

  it('should return cyan for science tags', () => {
    expect(getNodeColor('science,physics')).toBe('#06b6d4');
  });

  it('should return default gray for empty tags', () => {
    expect(getNodeColor('')).toBe('#6b7280');
  });

  it('should return default gray for unknown tags', () => {
    expect(getNodeColor('cooking,gardening')).toBe('#6b7280');
  });

  it('should handle case-insensitive matching', () => {
    expect(getNodeColor('AI,ML')).toBe('#8b5cf6');
    expect(getNodeColor('Security')).toBe('#ef4444');
  });

  it('should handle whitespace in tags', () => {
    expect(getNodeColor('ai , research , data')).toBe('#8b5cf6');
  });

  it('should match first applicable tag color (priority)', () => {
    // 'ai' comes before 'security' in TAG_COLORS
    expect(getNodeColor('ai,security')).toBe('#8b5cf6');
  });
});

// ─── Node Initialization Logic ───

describe('KnowledgeGraph - Node Positioning', () => {
  it('should distribute nodes in a circle', () => {
    const width = 800;
    const height = 500;
    const cx = width / 2;
    const cy = height / 2;
    const noteCount = 6;
    const radius = Math.min(width, height) * 0.3;

    const positions = Array.from({ length: noteCount }, (_, i) => {
      const angle = (2 * Math.PI * i) / noteCount;
      return {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      };
    });

    // All positions should be within bounds
    for (const pos of positions) {
      expect(pos.x).toBeGreaterThan(0);
      expect(pos.x).toBeLessThan(width);
      expect(pos.y).toBeGreaterThan(0);
      expect(pos.y).toBeLessThan(height);
    }

    // First node should be at the right (angle=0)
    expect(positions[0].x).toBeGreaterThan(cx);
    expect(Math.abs(positions[0].y - cy)).toBeLessThan(1);
  });

  it('should handle single node', () => {
    const noteCount = 1;
    const cx = 400, cy = 250;
    const radius = 150;
    const angle = 0;

    const pos = {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };

    expect(pos.x).toBe(cx + radius);
    expect(pos.y).toBe(cy);
  });

  it('should handle empty graph', () => {
    const notes: unknown[] = [];
    const nodes = notes.map((_, i) => ({
      x: 400 + 150 * Math.cos((2 * Math.PI * i) / Math.max(notes.length, 1)),
      y: 250 + 150 * Math.sin((2 * Math.PI * i) / Math.max(notes.length, 1)),
    }));
    expect(nodes).toHaveLength(0);
  });
});

// ─── Force Simulation Logic ───

describe('KnowledgeGraph - Physics Simulation', () => {
  it('should apply center gravity', () => {
    const cx = 400, cy = 250;
    const node = { x: 600, y: 100, vx: 0, vy: 0 };

    node.vx += (cx - node.x) * 0.001;
    node.vy += (cy - node.y) * 0.001;

    expect(node.vx).toBeLessThan(0); // Pulled left toward center
    expect(node.vy).toBeGreaterThan(0); // Pulled down toward center
  });

  it('should repel overlapping nodes', () => {
    const node = { x: 100, y: 100, vx: 0, vy: 0 };
    const other = { x: 102, y: 100 };

    const dx = node.x - other.x;
    const dy = node.y - other.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const force = 800 / (dist * dist);
    node.vx += (dx / dist) * force;
    node.vy += (dy / dist) * force;

    // Node should be pushed away (leftward since it's to the left of other)
    expect(node.vx).toBeLessThan(0);
  });

  it('should attract connected nodes via edges', () => {
    const source = { x: 100, y: 100, vx: 0, vy: 0 };
    const target = { x: 300, y: 100 };

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const force = (dist - 120) * 0.005;
    source.vx += (dx / dist) * force;
    source.vy += (dy / dist) * force;

    // Source should be pulled toward target (rightward)
    expect(source.vx).toBeGreaterThan(0);
  });

  it('should apply velocity damping', () => {
    const node = { vx: 10, vy: -5 };
    node.vx *= 0.85;
    node.vy *= 0.85;

    expect(node.vx).toBe(8.5);
    expect(node.vy).toBe(-4.25);
  });

  it('should constrain nodes within boundaries', () => {
    const width = 800, height = 500;
    const radius = 24;
    const node = { x: -10, y: 600, radius };

    node.x = Math.max(node.radius, Math.min(width - node.radius, node.x));
    node.y = Math.max(node.radius, Math.min(height - node.radius, node.y));

    expect(node.x).toBe(radius); // Clamped to left boundary
    expect(node.y).toBe(height - radius); // Clamped to bottom boundary
  });
});

// ─── Node Hit Detection ───

describe('KnowledgeGraph - Hit Detection', () => {
  function findNode(nodes: { id: string; x: number; y: number; radius: number }[], x: number, y: number) {
    for (const node of [...nodes].reverse()) {
      const dx = x - node.x;
      const dy = y - node.y;
      if (dx * dx + dy * dy < (node.radius + 4) ** 2) return node;
    }
    return null;
  }

  it('should detect click on node center', () => {
    const nodes = [{ id: 'n1', x: 100, y: 100, radius: 24 }];
    const hit = findNode(nodes, 100, 100);
    expect(hit?.id).toBe('n1');
  });

  it('should detect click near node edge', () => {
    const nodes = [{ id: 'n1', x: 100, y: 100, radius: 24 }];
    const hit = findNode(nodes, 125, 100); // Within radius+4 = 28
    expect(hit?.id).toBe('n1');
  });

  it('should miss click outside node', () => {
    const nodes = [{ id: 'n1', x: 100, y: 100, radius: 24 }];
    const hit = findNode(nodes, 200, 200);
    expect(hit).toBeNull();
  });

  it('should select topmost node on overlap', () => {
    const nodes = [
      { id: 'n1', x: 100, y: 100, radius: 24 },
      { id: 'n2', x: 110, y: 100, radius: 24 }, // Overlapping, drawn later (on top)
    ];
    const hit = findNode(nodes, 105, 100);
    expect(hit?.id).toBe('n2'); // Should select the topmost (last drawn)
  });

  it('should handle empty graph', () => {
    const hit = findNode([], 100, 100);
    expect(hit).toBeNull();
  });
});

// ─── Label Truncation ───

describe('KnowledgeGraph - Label Rendering', () => {
  function truncateLabel(title: string): string {
    return title.length > 18 ? title.slice(0, 16) + '...' : title;
  }

  it('should not truncate short titles', () => {
    expect(truncateLabel('RAG Overview')).toBe('RAG Overview');
  });

  it('should truncate long titles at 16 chars + ellipsis', () => {
    expect(truncateLabel('Transformer Architecture Deep Dive')).toBe('Transformer Arch...');
  });

  it('should handle exactly 18 character titles', () => {
    expect(truncateLabel('123456789012345678')).toBe('123456789012345678');
  });

  it('should handle 19 character titles', () => {
    expect(truncateLabel('1234567890123456789')).toBe('1234567890123456...');
  });
});

// ─── Edge Highlighting ───

describe('KnowledgeGraph - Edge Highlighting', () => {
  it('should highlight edges connected to hovered node', () => {
    const edge = { source: 'n1', target: 'n2', relationship: 'relates to' };
    const hoveredNode = 'n1';

    const isHighlighted = hoveredNode === edge.source || hoveredNode === edge.target;
    expect(isHighlighted).toBe(true);
  });

  it('should highlight edges connected to selected node', () => {
    const edge = { source: 'n1', target: 'n2', relationship: 'relies on' };
    const selectedId = 'n2';

    const isHighlighted = selectedId === edge.source || selectedId === edge.target;
    expect(isHighlighted).toBe(true);
  });

  it('should not highlight unrelated edges', () => {
    const edge = { source: 'n1', target: 'n2', relationship: 'test' };
    const hoveredNode = 'n3';
    const selectedId = 'n4';

    const isHighlighted = hoveredNode === edge.source || hoveredNode === edge.target ||
      selectedId === edge.source || selectedId === edge.target;
    expect(isHighlighted).toBe(false);
  });
});
