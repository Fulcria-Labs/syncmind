import { describe, it, expect } from 'vitest';

// ─── Extract and test pure logic from KnowledgeGraph.tsx ───

// TAG_COLORS config
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

// getNodeColor logic
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

// Label truncation logic
function truncateLabel(title: string, maxLen = 18): string {
  return title.length > maxLen ? title.slice(0, maxLen - 2) + '...' : title;
}

// Initial node positioning (circular layout)
function calculateInitialPosition(
  index: number,
  total: number,
  centerX: number,
  centerY: number,
  radius: number
): { x: number; y: number } {
  const angle = (2 * Math.PI * index) / Math.max(total, 1);
  return {
    x: centerX + radius * Math.cos(angle),
    y: centerY + radius * Math.sin(angle)
  };
}

// Boundary constraint
function constrainPosition(
  x: number, y: number,
  nodeRadius: number,
  width: number, height: number
): { x: number; y: number } {
  return {
    x: Math.max(nodeRadius, Math.min(width - nodeRadius, x)),
    y: Math.max(nodeRadius, Math.min(height - nodeRadius, y))
  };
}

// Node radius with hover/selected adjustment
function getEffectiveRadius(base: number, isHovered: boolean, isSelected: boolean): number {
  return base + (isHovered ? 4 : 0) + (isSelected ? 2 : 0);
}

// Hit test (is click within node bounds)
function isPointInNode(
  px: number, py: number,
  nodeX: number, nodeY: number,
  nodeRadius: number,
  margin: number = 4
): boolean {
  const dx = px - nodeX;
  const dy = py - nodeY;
  return dx * dx + dy * dy < (nodeRadius + margin) ** 2;
}

// Force simulation: center gravity
function calculateCenterGravity(
  nodeX: number, nodeY: number,
  centerX: number, centerY: number,
  strength: number = 0.001
): { fx: number; fy: number } {
  return {
    fx: (centerX - nodeX) * strength,
    fy: (centerY - nodeY) * strength
  };
}

// Force simulation: repulsion between nodes
function calculateRepulsion(
  x1: number, y1: number,
  x2: number, y2: number,
  repulsionForce: number = 800
): { fx: number; fy: number } {
  const dx = x1 - x2;
  const dy = y1 - y2;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const force = repulsionForce / (dist * dist);
  return {
    fx: (dx / dist) * force,
    fy: (dy / dist) * force
  };
}

// Edge attraction
function calculateEdgeAttraction(
  sourceX: number, sourceY: number,
  targetX: number, targetY: number,
  idealLength: number = 120,
  strength: number = 0.005
): { fx: number; fy: number } {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const force = (dist - idealLength) * strength;
  return {
    fx: (dx / dist) * force,
    fy: (dy / dist) * force
  };
}

// Damping velocity
function applyDamping(vx: number, vy: number, damping: number = 0.85): { vx: number; vy: number } {
  return { vx: vx * damping, vy: vy * damping };
}

// Minimum dimensions
function clampDimensions(width: number, height: number): { width: number; height: number } {
  return {
    width: Math.max(400, width),
    height: Math.max(300, height)
  };
}

// Edge midpoint for label placement
function getEdgeMidpoint(x1: number, y1: number, x2: number, y2: number): { x: number; y: number } {
  return {
    x: (x1 + x2) / 2,
    y: (y1 + y2) / 2
  };
}

// ─── Node Color by Tags ───

describe('KnowledgeGraph - Node Color by Tags', () => {
  it('returns AI color for ai tag', () => {
    expect(getNodeColor('ai')).toBe('#8b5cf6');
  });

  it('returns AI color for machine-learning tag', () => {
    expect(getNodeColor('machine-learning')).toBe('#8b5cf6');
  });

  it('returns security color', () => {
    expect(getNodeColor('security')).toBe('#ef4444');
  });

  it('returns web color', () => {
    expect(getNodeColor('web')).toBe('#3b82f6');
  });

  it('returns data color', () => {
    expect(getNodeColor('data')).toBe('#10b981');
  });

  it('returns research color', () => {
    expect(getNodeColor('research')).toBe('#f59e0b');
  });

  it('returns science color', () => {
    expect(getNodeColor('science')).toBe('#06b6d4');
  });

  it('returns default for unknown tag', () => {
    expect(getNodeColor('cooking')).toBe('#6b7280');
  });

  it('returns default for empty tags', () => {
    expect(getNodeColor('')).toBe('#6b7280');
  });

  it('uses first matching tag in comma-separated list', () => {
    expect(getNodeColor('cooking,security,web')).toBe('#ef4444');
  });

  it('is case insensitive', () => {
    expect(getNodeColor('AI')).toBe('#8b5cf6');
    expect(getNodeColor('Security')).toBe('#ef4444');
  });

  it('matches partial tag names', () => {
    // "data" is a substring of "database"
    expect(getNodeColor('database')).toBe('#10b981');
  });

  it('handles whitespace in tags', () => {
    expect(getNodeColor(' ai , web ')).toBe('#8b5cf6');
  });
});

// ─── Label Truncation ───

describe('KnowledgeGraph - Label Truncation', () => {
  it('keeps short labels unchanged', () => {
    expect(truncateLabel('Short')).toBe('Short');
  });

  it('truncates long labels with ellipsis', () => {
    const longTitle = 'A Very Long Note Title That Exceeds Limit';
    const result = truncateLabel(longTitle);
    expect(result.endsWith('...')).toBe(true);
    // maxLen - 2 chars + '...' (3 chars) = maxLen + 1 total
    expect(result.length).toBe(19); // 16 chars + '...'
  });

  it('keeps labels exactly at limit', () => {
    const exact = '123456789012345678'; // 18 chars
    expect(truncateLabel(exact)).toBe(exact);
  });

  it('truncates labels one over limit', () => {
    const overByOne = '1234567890123456789'; // 19 chars
    expect(truncateLabel(overByOne)).toContain('...');
  });

  it('handles empty string', () => {
    expect(truncateLabel('')).toBe('');
  });

  it('respects custom max length', () => {
    const result = truncateLabel('Long title here', 10);
    // maxLen - 2 + '...' = 8 + 3 = 11, but the label is capped at the truncation
    expect(result.length).toBeLessThanOrEqual(11);
    expect(result.endsWith('...')).toBe(true);
  });
});

// ─── Circular Layout ───

describe('KnowledgeGraph - Circular Layout', () => {
  it('places first node at rightmost position', () => {
    const pos = calculateInitialPosition(0, 4, 400, 250, 100);
    expect(pos.x).toBeCloseTo(500); // cx + radius
    expect(pos.y).toBeCloseTo(250); // cy
  });

  it('places nodes evenly spaced', () => {
    const positions = Array.from({ length: 4 }, (_, i) =>
      calculateInitialPosition(i, 4, 400, 250, 100)
    );
    // All nodes should be at distance 'radius' from center
    for (const pos of positions) {
      const dist = Math.sqrt((pos.x - 400) ** 2 + (pos.y - 250) ** 2);
      expect(dist).toBeCloseTo(100);
    }
  });

  it('handles single node (total=1)', () => {
    const pos = calculateInitialPosition(0, 1, 400, 250, 100);
    expect(isFinite(pos.x)).toBe(true);
    expect(isFinite(pos.y)).toBe(true);
  });

  it('handles zero nodes safely', () => {
    // total=0 uses Math.max(total, 1)
    const pos = calculateInitialPosition(0, 0, 400, 250, 100);
    expect(isFinite(pos.x)).toBe(true);
  });
});

// ─── Boundary Constraints ───

describe('KnowledgeGraph - Boundary Constraints', () => {
  it('constrains node to left boundary', () => {
    const { x } = constrainPosition(-10, 250, 24, 800, 500);
    expect(x).toBe(24);
  });

  it('constrains node to right boundary', () => {
    const { x } = constrainPosition(900, 250, 24, 800, 500);
    expect(x).toBe(776);
  });

  it('constrains node to top boundary', () => {
    const { y } = constrainPosition(400, -10, 24, 800, 500);
    expect(y).toBe(24);
  });

  it('constrains node to bottom boundary', () => {
    const { y } = constrainPosition(400, 600, 24, 800, 500);
    expect(y).toBe(476);
  });

  it('does not modify position within bounds', () => {
    const { x, y } = constrainPosition(400, 250, 24, 800, 500);
    expect(x).toBe(400);
    expect(y).toBe(250);
  });
});

// ─── Effective Radius ───

describe('KnowledgeGraph - Effective Radius', () => {
  it('returns base radius for normal state', () => {
    expect(getEffectiveRadius(24, false, false)).toBe(24);
  });

  it('adds 4 for hovered state', () => {
    expect(getEffectiveRadius(24, true, false)).toBe(28);
  });

  it('adds 2 for selected state', () => {
    expect(getEffectiveRadius(24, false, true)).toBe(26);
  });

  it('adds both for hovered and selected', () => {
    expect(getEffectiveRadius(24, true, true)).toBe(30);
  });
});

// ─── Hit Testing ───

describe('KnowledgeGraph - Hit Testing', () => {
  it('detects click inside node', () => {
    expect(isPointInNode(100, 100, 100, 100, 24)).toBe(true);
  });

  it('detects click on node edge', () => {
    expect(isPointInNode(127, 100, 100, 100, 24)).toBe(true);
  });

  it('misses click outside node', () => {
    expect(isPointInNode(200, 200, 100, 100, 24)).toBe(false);
  });

  it('includes margin in hit area', () => {
    // Node radius 24 + margin 4 = 28 px hit area
    expect(isPointInNode(127, 100, 100, 100, 24, 4)).toBe(true);
  });

  it('detects click at center', () => {
    expect(isPointInNode(50, 50, 50, 50, 24)).toBe(true);
  });
});

// ─── Force Calculations ───

describe('KnowledgeGraph - Center Gravity', () => {
  it('pulls right when node is left of center', () => {
    const { fx } = calculateCenterGravity(100, 250, 400, 250);
    expect(fx).toBeGreaterThan(0);
  });

  it('pulls left when node is right of center', () => {
    const { fx } = calculateCenterGravity(700, 250, 400, 250);
    expect(fx).toBeLessThan(0);
  });

  it('no force when at center', () => {
    const { fx, fy } = calculateCenterGravity(400, 250, 400, 250);
    expect(fx).toBe(0);
    expect(fy).toBe(0);
  });
});

describe('KnowledgeGraph - Node Repulsion', () => {
  it('pushes nodes apart when close', () => {
    const { fx } = calculateRepulsion(100, 100, 110, 100);
    expect(fx).toBeLessThan(0); // push left away from right neighbor
  });

  it('stronger force when closer', () => {
    const close = calculateRepulsion(100, 100, 105, 100);
    const far = calculateRepulsion(100, 100, 200, 100);
    expect(Math.abs(close.fx)).toBeGreaterThan(Math.abs(far.fx));
  });

  it('handles coincident nodes', () => {
    const { fx, fy } = calculateRepulsion(100, 100, 100, 100);
    // Distance defaults to 1 to avoid division by zero
    expect(isFinite(fx)).toBe(true);
    expect(isFinite(fy)).toBe(true);
  });
});

describe('KnowledgeGraph - Edge Attraction', () => {
  it('attracts when distance > ideal length', () => {
    const { fx } = calculateEdgeAttraction(0, 0, 200, 0, 120);
    expect(fx).toBeGreaterThan(0); // pulls source toward target
  });

  it('repels when distance < ideal length', () => {
    const { fx } = calculateEdgeAttraction(0, 0, 50, 0, 120);
    expect(fx).toBeLessThan(0); // pushes source away from target
  });

  it('no force at ideal distance', () => {
    const { fx } = calculateEdgeAttraction(0, 0, 120, 0, 120);
    expect(Math.abs(fx)).toBeLessThan(0.001);
  });
});

// ─── Velocity Damping ───

describe('KnowledgeGraph - Velocity Damping', () => {
  it('reduces velocity by damping factor', () => {
    const { vx, vy } = applyDamping(10, 10, 0.85);
    expect(vx).toBe(8.5);
    expect(vy).toBe(8.5);
  });

  it('handles zero velocity', () => {
    const { vx, vy } = applyDamping(0, 0);
    expect(vx).toBe(0);
    expect(vy).toBe(0);
  });

  it('handles negative velocity', () => {
    const { vx } = applyDamping(-10, 0, 0.85);
    expect(vx).toBe(-8.5);
  });

  it('approaches zero over iterations', () => {
    let vx = 100;
    for (let i = 0; i < 100; i++) {
      const result = applyDamping(vx, 0);
      vx = result.vx;
    }
    expect(Math.abs(vx)).toBeLessThan(0.01);
  });
});

// ─── Dimension Clamping ───

describe('KnowledgeGraph - Dimension Clamping', () => {
  it('enforces minimum width of 400', () => {
    const { width } = clampDimensions(200, 500);
    expect(width).toBe(400);
  });

  it('enforces minimum height of 300', () => {
    const { height } = clampDimensions(800, 100);
    expect(height).toBe(300);
  });

  it('keeps dimensions above minimum', () => {
    const { width, height } = clampDimensions(1000, 800);
    expect(width).toBe(1000);
    expect(height).toBe(800);
  });

  it('handles zero dimensions', () => {
    const { width, height } = clampDimensions(0, 0);
    expect(width).toBe(400);
    expect(height).toBe(300);
  });
});

// ─── Edge Midpoint ───

describe('KnowledgeGraph - Edge Midpoint', () => {
  it('calculates midpoint correctly', () => {
    const { x, y } = getEdgeMidpoint(0, 0, 100, 100);
    expect(x).toBe(50);
    expect(y).toBe(50);
  });

  it('handles same point', () => {
    const { x, y } = getEdgeMidpoint(50, 50, 50, 50);
    expect(x).toBe(50);
    expect(y).toBe(50);
  });

  it('handles negative coordinates', () => {
    const { x, y } = getEdgeMidpoint(-100, -100, 100, 100);
    expect(x).toBe(0);
    expect(y).toBe(0);
  });
});
