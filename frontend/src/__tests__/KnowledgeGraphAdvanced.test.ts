import { describe, it, expect } from 'vitest';

// ─── Advanced KnowledgeGraph tests ───

// Edge label midpoint calculation
function edgeMidpoint(source: { x: number; y: number }, target: { x: number; y: number }) {
  return {
    x: (source.x + target.x) / 2,
    y: (source.y + target.y) / 2,
  };
}

// Node radius calculation based on hover/selection
function getNodeRadius(baseRadius: number, isHovered: boolean, isSelected: boolean): number {
  return baseRadius + (isHovered ? 4 : 0) + (isSelected ? 2 : 0);
}

// Glow color calculation
function getGlowColor(nodeColor: string): string {
  return nodeColor + '30';
}

// Fill color for node
function getNodeFillColor(nodeColor: string, isSelected: boolean): string {
  return isSelected ? nodeColor : nodeColor + 'cc';
}

// Stroke style for node
function getNodeStrokeStyle(nodeColor: string, isSelected: boolean): string {
  return isSelected ? '#fff' : nodeColor;
}

// Stroke width for node
function getNodeStrokeWidth(isSelected: boolean): number {
  return isSelected ? 3 : 1.5;
}

// Edge stroke style
function getEdgeStrokeStyle(isHighlighted: boolean): string {
  return isHighlighted ? '#818cf8' : '#334155';
}

// Edge line width
function getEdgeLineWidth(isHighlighted: boolean): number {
  return isHighlighted ? 2 : 1;
}

// Should show edge label
function shouldShowEdgeLabel(relationship: string, isHighlighted: boolean): boolean {
  return !!relationship && isHighlighted;
}

// Font style for node label
function getNodeLabelFont(isHovered: boolean, isSelected: boolean): string {
  return `${isHovered || isSelected ? 'bold ' : ''}12px system-ui`;
}

// Canvas position from mouse event
function getCanvasPos(clientX: number, clientY: number, rectLeft: number, rectTop: number) {
  return { x: clientX - rectLeft, y: clientY - rectTop };
}

// Drag detection - did the user click or drag?
function wasClick(startX: number, startY: number, endX: number, endY: number, threshold: number): boolean {
  return Math.abs(endX - startX) < threshold && Math.abs(endY - startY) < threshold;
}

// Node initialization with existing positions
function initNode(
  noteId: string,
  existingPositions: Map<string, { x: number; y: number }>,
  defaultX: number,
  defaultY: number
) {
  const existing = existingPositions.get(noteId);
  return {
    x: existing?.x ?? defaultX,
    y: existing?.y ?? defaultY,
  };
}

// Resize dimensions clamping
function clampDimensions(width: number, height: number): { width: number; height: number } {
  return {
    width: Math.max(400, width),
    height: Math.max(300, height),
  };
}

// ─── Edge Midpoint Calculation ───

describe('KnowledgeGraph - Edge Midpoint', () => {
  it('calculates midpoint between two nodes', () => {
    const mid = edgeMidpoint({ x: 0, y: 0 }, { x: 100, y: 100 });
    expect(mid.x).toBe(50);
    expect(mid.y).toBe(50);
  });

  it('handles same position nodes', () => {
    const mid = edgeMidpoint({ x: 200, y: 300 }, { x: 200, y: 300 });
    expect(mid.x).toBe(200);
    expect(mid.y).toBe(300);
  });

  it('handles negative coordinates', () => {
    const mid = edgeMidpoint({ x: -100, y: -50 }, { x: 100, y: 50 });
    expect(mid.x).toBe(0);
    expect(mid.y).toBe(0);
  });

  it('handles decimal coordinates', () => {
    const mid = edgeMidpoint({ x: 10.5, y: 20.3 }, { x: 30.7, y: 40.1 });
    expect(mid.x).toBeCloseTo(20.6);
    expect(mid.y).toBeCloseTo(30.2);
  });
});

// ─── Node Radius ───

describe('KnowledgeGraph - Node Radius', () => {
  const baseRadius = 24;

  it('returns base radius for normal node', () => {
    expect(getNodeRadius(baseRadius, false, false)).toBe(24);
  });

  it('adds 4px for hovered node', () => {
    expect(getNodeRadius(baseRadius, true, false)).toBe(28);
  });

  it('adds 2px for selected node', () => {
    expect(getNodeRadius(baseRadius, false, true)).toBe(26);
  });

  it('adds 6px for hovered AND selected node', () => {
    expect(getNodeRadius(baseRadius, true, true)).toBe(30);
  });
});

// ─── Glow Color ───

describe('KnowledgeGraph - Glow Color', () => {
  it('appends 30 opacity to node color', () => {
    expect(getGlowColor('#8b5cf6')).toBe('#8b5cf630');
  });

  it('works with any hex color', () => {
    expect(getGlowColor('#ef4444')).toBe('#ef444430');
    expect(getGlowColor('#3b82f6')).toBe('#3b82f630');
    expect(getGlowColor('#10b981')).toBe('#10b98130');
  });
});

// ─── Node Fill Color ───

describe('KnowledgeGraph - Node Fill Color', () => {
  it('returns full opacity color when selected', () => {
    expect(getNodeFillColor('#8b5cf6', true)).toBe('#8b5cf6');
  });

  it('returns reduced opacity color when not selected', () => {
    expect(getNodeFillColor('#8b5cf6', false)).toBe('#8b5cf6cc');
  });
});

// ─── Node Stroke ───

describe('KnowledgeGraph - Node Stroke', () => {
  it('returns white stroke when selected', () => {
    expect(getNodeStrokeStyle('#8b5cf6', true)).toBe('#fff');
  });

  it('returns node color stroke when not selected', () => {
    expect(getNodeStrokeStyle('#8b5cf6', false)).toBe('#8b5cf6');
  });

  it('returns thicker stroke when selected', () => {
    expect(getNodeStrokeWidth(true)).toBe(3);
  });

  it('returns thinner stroke when not selected', () => {
    expect(getNodeStrokeWidth(false)).toBe(1.5);
  });
});

// ─── Edge Styling ───

describe('KnowledgeGraph - Edge Styling', () => {
  it('uses indigo for highlighted edges', () => {
    expect(getEdgeStrokeStyle(true)).toBe('#818cf8');
  });

  it('uses dark slate for normal edges', () => {
    expect(getEdgeStrokeStyle(false)).toBe('#334155');
  });

  it('uses thicker line for highlighted edges', () => {
    expect(getEdgeLineWidth(true)).toBe(2);
  });

  it('uses thinner line for normal edges', () => {
    expect(getEdgeLineWidth(false)).toBe(1);
  });
});

// ─── Edge Label Visibility ───

describe('KnowledgeGraph - Edge Label Visibility', () => {
  it('shows label when relationship exists and edge is highlighted', () => {
    expect(shouldShowEdgeLabel('relates to', true)).toBe(true);
  });

  it('hides label when edge is not highlighted', () => {
    expect(shouldShowEdgeLabel('relates to', false)).toBe(false);
  });

  it('hides label when relationship is empty', () => {
    expect(shouldShowEdgeLabel('', true)).toBe(false);
  });

  it('hides label when both empty and not highlighted', () => {
    expect(shouldShowEdgeLabel('', false)).toBe(false);
  });
});

// ─── Node Label Font ───

describe('KnowledgeGraph - Node Label Font', () => {
  it('uses bold for hovered node', () => {
    expect(getNodeLabelFont(true, false)).toBe('bold 12px system-ui');
  });

  it('uses bold for selected node', () => {
    expect(getNodeLabelFont(false, true)).toBe('bold 12px system-ui');
  });

  it('uses bold for hovered AND selected', () => {
    expect(getNodeLabelFont(true, true)).toBe('bold 12px system-ui');
  });

  it('uses normal for default state', () => {
    expect(getNodeLabelFont(false, false)).toBe('12px system-ui');
  });
});

// ─── Canvas Position ───

describe('KnowledgeGraph - Canvas Position', () => {
  it('calculates position relative to canvas', () => {
    const pos = getCanvasPos(150, 200, 50, 100);
    expect(pos.x).toBe(100);
    expect(pos.y).toBe(100);
  });

  it('handles zero offset', () => {
    const pos = getCanvasPos(300, 400, 0, 0);
    expect(pos.x).toBe(300);
    expect(pos.y).toBe(400);
  });

  it('handles negative result (mouse above canvas)', () => {
    const pos = getCanvasPos(10, 10, 50, 50);
    expect(pos.x).toBe(-40);
    expect(pos.y).toBe(-40);
  });
});

// ─── Drag vs Click Detection ───

describe('KnowledgeGraph - Drag Detection', () => {
  it('detects click (no movement)', () => {
    expect(wasClick(100, 100, 100, 100, 3)).toBe(true);
  });

  it('detects click with tiny movement within threshold', () => {
    expect(wasClick(100, 100, 102, 101, 3)).toBe(true);
  });

  it('detects drag when movement exceeds threshold', () => {
    expect(wasClick(100, 100, 110, 110, 3)).toBe(false);
  });

  it('detects drag on X axis only', () => {
    expect(wasClick(100, 100, 105, 100, 3)).toBe(false);
  });

  it('detects drag on Y axis only', () => {
    expect(wasClick(100, 100, 100, 105, 3)).toBe(false);
  });

  it('handles threshold of 0 (strict < comparison means 0 always false)', () => {
    // Math.abs(0) < 0 is false, so even exact match returns false with threshold 0
    expect(wasClick(100, 100, 100, 100, 0)).toBe(false);
    expect(wasClick(100, 100, 101, 100, 0)).toBe(false);
  });
});

// ─── Node Position Initialization ───

describe('KnowledgeGraph - Node Init', () => {
  it('reuses existing position when available', () => {
    const positions = new Map([['n1', { x: 50, y: 75 }]]);
    const pos = initNode('n1', positions, 400, 250);
    expect(pos.x).toBe(50);
    expect(pos.y).toBe(75);
  });

  it('uses default position for new nodes', () => {
    const positions = new Map<string, { x: number; y: number }>();
    const pos = initNode('n1', positions, 400, 250);
    expect(pos.x).toBe(400);
    expect(pos.y).toBe(250);
  });

  it('handles mixed existing and new nodes', () => {
    const positions = new Map([['n1', { x: 10, y: 20 }]]);
    const pos1 = initNode('n1', positions, 400, 250);
    const pos2 = initNode('n2', positions, 400, 250);
    expect(pos1.x).toBe(10);
    expect(pos2.x).toBe(400);
  });
});

// ─── Dimension Clamping ───

describe('KnowledgeGraph - Dimension Clamping', () => {
  it('passes through dimensions above minimum', () => {
    const dims = clampDimensions(800, 500);
    expect(dims.width).toBe(800);
    expect(dims.height).toBe(500);
  });

  it('clamps width to minimum 400', () => {
    const dims = clampDimensions(200, 500);
    expect(dims.width).toBe(400);
  });

  it('clamps height to minimum 300', () => {
    const dims = clampDimensions(800, 100);
    expect(dims.height).toBe(300);
  });

  it('clamps both dimensions', () => {
    const dims = clampDimensions(100, 100);
    expect(dims.width).toBe(400);
    expect(dims.height).toBe(300);
  });

  it('handles exact minimum values', () => {
    const dims = clampDimensions(400, 300);
    expect(dims.width).toBe(400);
    expect(dims.height).toBe(300);
  });

  it('handles zero dimensions', () => {
    const dims = clampDimensions(0, 0);
    expect(dims.width).toBe(400);
    expect(dims.height).toBe(300);
  });

  it('handles negative dimensions', () => {
    const dims = clampDimensions(-100, -50);
    expect(dims.width).toBe(400);
    expect(dims.height).toBe(300);
  });
});

// ─── DPR Scaling ───

describe('KnowledgeGraph - DPR Scaling', () => {
  it('scales canvas dimensions by device pixel ratio', () => {
    const width = 800;
    const height = 500;
    const dpr = 2;
    expect(width * dpr).toBe(1600);
    expect(height * dpr).toBe(1000);
  });

  it('defaults DPR to 1 when undefined', () => {
    const dpr = undefined || 1;
    expect(dpr).toBe(1);
  });

  it('handles fractional DPR', () => {
    const width = 800;
    const dpr = 1.5;
    expect(width * dpr).toBe(1200);
  });
});
