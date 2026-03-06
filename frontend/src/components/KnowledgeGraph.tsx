import { useRef, useEffect, useState, useCallback } from 'react';
import { useQuery } from '@powersync/react';

interface GraphNode {
  id: string;
  title: string;
  tags: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

interface GraphEdge {
  source: string;
  target: string;
  relationship: string;
}

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

interface KnowledgeGraphProps {
  onSelectNote: (id: string) => void;
  selectedId?: string;
}

export function KnowledgeGraph({ onSelectNote, selectedId }: KnowledgeGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const animRef = useRef<number>(0);
  const dragRef = useRef<{ node: GraphNode | null; offsetX: number; offsetY: number }>({ node: null, offsetX: 0, offsetY: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  const { data: notes } = useQuery<{ id: string; title: string; ai_tags: string }>(
    `SELECT id, title, ai_tags FROM notes`
  );

  const { data: connections } = useQuery<{ source_note_id: string; target_note_id: string; relationship: string }>(
    `SELECT source_note_id, target_note_id, relationship FROM connections`
  );

  // Initialize nodes and edges when data changes
  useEffect(() => {
    const existingPositions = new Map(nodesRef.current.map(n => [n.id, { x: n.x, y: n.y }]));
    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;

    nodesRef.current = notes.map((note, i) => {
      const existing = existingPositions.get(note.id);
      const angle = (2 * Math.PI * i) / Math.max(notes.length, 1);
      const radius = Math.min(dimensions.width, dimensions.height) * 0.3;
      return {
        id: note.id,
        title: note.title || 'Untitled',
        tags: note.ai_tags || '',
        x: existing?.x ?? cx + radius * Math.cos(angle) + (Math.random() - 0.5) * 40,
        y: existing?.y ?? cy + radius * Math.sin(angle) + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
        radius: 24,
        color: getNodeColor(note.ai_tags || ''),
      };
    });

    edgesRef.current = connections.map(c => ({
      source: c.source_note_id,
      target: c.target_note_id,
      relationship: c.relationship || '',
    }));
  }, [notes, connections, dimensions]);

  // Resize observer
  useEffect(() => {
    const container = canvasRef.current?.parentElement;
    if (!container) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width: Math.max(400, width), height: Math.max(300, height) });
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Force simulation + render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    const tick = () => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      if (nodes.length === 0) {
        ctx.clearRect(0, 0, dimensions.width, dimensions.height);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '16px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('Add notes to see your knowledge graph', dimensions.width / 2, dimensions.height / 2);
        animRef.current = requestAnimationFrame(tick);
        return;
      }

      const cx = dimensions.width / 2;
      const cy = dimensions.height / 2;

      // Force simulation step
      for (const node of nodes) {
        if (dragRef.current.node?.id === node.id) continue;

        // Center gravity
        node.vx += (cx - node.x) * 0.001;
        node.vy += (cy - node.y) * 0.001;

        // Node repulsion
        for (const other of nodes) {
          if (other.id === node.id) continue;
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 800 / (dist * dist);
          node.vx += (dx / dist) * force;
          node.vy += (dy / dist) * force;
        }
      }

      // Edge attraction
      for (const edge of edges) {
        const source = nodes.find(n => n.id === edge.source);
        const target = nodes.find(n => n.id === edge.target);
        if (!source || !target) continue;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 120) * 0.005;
        if (dragRef.current.node?.id !== source.id) {
          source.vx += (dx / dist) * force;
          source.vy += (dy / dist) * force;
        }
        if (dragRef.current.node?.id !== target.id) {
          target.vx -= (dx / dist) * force;
          target.vy -= (dy / dist) * force;
        }
      }

      // Apply velocity with damping and boundary constraints
      for (const node of nodes) {
        if (dragRef.current.node?.id === node.id) continue;
        node.vx *= 0.85;
        node.vy *= 0.85;
        node.x += node.vx;
        node.y += node.vy;
        node.x = Math.max(node.radius, Math.min(dimensions.width - node.radius, node.x));
        node.y = Math.max(node.radius, Math.min(dimensions.height - node.radius, node.y));
      }

      // Render
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // Draw edges
      for (const edge of edges) {
        const source = nodes.find(n => n.id === edge.source);
        const target = nodes.find(n => n.id === edge.target);
        if (!source || !target) continue;

        const isHighlighted = hoveredNode === source.id || hoveredNode === target.id ||
          selectedId === source.id || selectedId === target.id;

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = isHighlighted ? '#818cf8' : '#334155';
        ctx.lineWidth = isHighlighted ? 2 : 1;
        ctx.stroke();

        // Edge label
        if (edge.relationship && isHighlighted) {
          const mx = (source.x + target.x) / 2;
          const my = (source.y + target.y) / 2;
          ctx.fillStyle = '#94a3b8';
          ctx.font = '11px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText(edge.relationship, mx, my - 6);
        }
      }

      // Draw nodes
      for (const node of nodes) {
        const isSelected = node.id === selectedId;
        const isHovered = node.id === hoveredNode;
        const r = node.radius + (isHovered ? 4 : 0) + (isSelected ? 2 : 0);

        // Glow for selected/hovered
        if (isSelected || isHovered) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 6, 0, Math.PI * 2);
          ctx.fillStyle = node.color + '30';
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? node.color : node.color + 'cc';
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#fff' : node.color;
        ctx.lineWidth = isSelected ? 3 : 1.5;
        ctx.stroke();

        // Node label
        const label = node.title.length > 18 ? node.title.slice(0, 16) + '...' : node.title;
        ctx.fillStyle = '#e2e8f0';
        ctx.font = `${isHovered || isSelected ? 'bold ' : ''}12px system-ui`;
        ctx.textAlign = 'center';
        ctx.fillText(label, node.x, node.y + r + 16);
      }

      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [dimensions, hoveredNode, selectedId]);

  const findNode = useCallback((x: number, y: number) => {
    for (const node of [...nodesRef.current].reverse()) {
      const dx = x - node.x;
      const dy = y - node.y;
      if (dx * dx + dy * dy < (node.radius + 4) ** 2) return node;
    }
    return null;
  }, []);

  const getCanvasPos = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const pos = getCanvasPos(e);
    const node = findNode(pos.x, pos.y);
    if (node) {
      dragRef.current = { node, offsetX: pos.x - node.x, offsetY: pos.y - node.y };
    }
  }, [findNode, getCanvasPos]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const pos = getCanvasPos(e);
    if (dragRef.current.node) {
      dragRef.current.node.x = pos.x - dragRef.current.offsetX;
      dragRef.current.node.y = pos.y - dragRef.current.offsetY;
      dragRef.current.node.vx = 0;
      dragRef.current.node.vy = 0;
    } else {
      const node = findNode(pos.x, pos.y);
      setHoveredNode(node?.id ?? null);
      if (canvasRef.current) {
        canvasRef.current.style.cursor = node ? 'pointer' : 'default';
      }
    }
  }, [findNode, getCanvasPos]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (dragRef.current.node) {
      const pos = getCanvasPos(e);
      const moved = Math.abs(pos.x - (dragRef.current.node.x + dragRef.current.offsetX)) < 3 &&
                    Math.abs(pos.y - (dragRef.current.node.y + dragRef.current.offsetY)) < 3;
      if (moved) {
        onSelectNote(dragRef.current.node.id);
      }
      dragRef.current = { node: null, offsetX: 0, offsetY: 0 };
    }
  }, [onSelectNote, getCanvasPos]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (dragRef.current.node) return;
    const pos = getCanvasPos(e);
    const node = findNode(pos.x, pos.y);
    if (node) onSelectNote(node.id);
  }, [findNode, getCanvasPos, onSelectNote]);

  return (
    <div className="knowledge-graph">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ width: '100%', height: '100%' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
      />
    </div>
  );
}
