import { Network } from 'lucide-react';
import {
  PointerEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

interface Relation {
  source: string;
  target: string;
  relation: string;
  description: string;
}

interface ParsedKnowledgeGraphContent {
  entity: string;
  type: string;
  similarity: string;
  description: string;
  relations: Relation[];
}

interface GraphNode {
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  highlighted: boolean;
}

interface GraphEdge extends Relation {
  sourceNode: GraphNode;
  targetNode: GraphNode;
}

interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  hiddenCount: number;
}

const TYPE_COLORS = [
  '#2563eb',
  '#dc2626',
  '#059669',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#be123c',
  '#4f46e5',
  '#65a30d',
  '#9333ea',
];

const GRAPH_WIDTH = 720;
const GRAPH_HEIGHT = 440;
const NODE_LABEL_GAP = 15;

const getField = (content: string, field: string, nextFields: string[]) => {
  if (!nextFields.length) {
    const match = content.match(new RegExp(`${field}:\\s*([\\s\\S]*)$`, 'i'));
    return match?.[1]?.trim() ?? '';
  }

  const nextPattern = nextFields.map((item) => `${item}:`).join('|');
  const match = content.match(
    new RegExp(`${field}:\\s*([\\s\\S]*?)(?=\\s+(?:${nextPattern})|$)`, 'i'),
  );
  return match?.[1]?.trim() ?? '';
};

const parseRelations = (content: string) => {
  const relations: Relation[] = [];
  const relationReg =
    /Relation:\s*([\s\S]*?)\s*->\s*([\s\S]*?)\s*\(([\s\S]*?)\)\s*(?:-\s*([\s\S]*?))?(?=\s+Relation:|$)/gi;
  let match: RegExpExecArray | null;

  while ((match = relationReg.exec(content))) {
    relations.push({
      source: match[1].trim(),
      target: match[2].trim(),
      relation: match[3].trim(),
      description: (match[4] ?? '').trim(),
    });
  }

  return relations;
};

const parseKnowledgeGraphContent = (
  content: string,
): ParsedKnowledgeGraphContent => {
  const normalized = content.replace(/\s+/g, ' ').trim();
  const relationStart = normalized.search(
    /\bRelated relationships:|\bRelation:/i,
  );
  const header =
    relationStart >= 0 ? normalized.slice(0, relationStart) : normalized;
  const relationText =
    relationStart >= 0 ? normalized.slice(relationStart) : '';

  return {
    entity: getField(header, 'Entity', ['Type', 'Similarity', 'Description']),
    type: getField(header, 'Type', ['Similarity', 'Description']),
    similarity: getField(header, 'Similarity', ['Description']),
    description: getField(header, 'Description', []),
    relations: parseRelations(relationText),
  };
};

const hashText = (text = '') => {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const getNodeColor = (name?: string, highlighted?: boolean) => {
  if (highlighted) return '#2563eb';
  return TYPE_COLORS[hashText(name || 'Entity') % TYPE_COLORS.length];
};

const truncate = (text: string, length = 12) =>
  text.length > length ? `${text.slice(0, length)}...` : text;

const nodeLabelWidth = (name: string) =>
  Math.min(126, Math.max(58, truncate(name, 12).length * 10 + 16));

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const getNodeBounds = (node: GraphNode) => {
  const radius = node.highlighted ? 14 : 11;
  const labelWidth = nodeLabelWidth(node.name);
  return {
    left: node.x - radius - 8,
    right: node.x + NODE_LABEL_GAP + labelWidth + 8,
    top: node.y - 18,
    bottom: node.y + 18,
    centerX: node.x + (NODE_LABEL_GAP + labelWidth) / 2,
    centerY: node.y,
  };
};

const keepNodeInsideCanvas = (node: GraphNode) => {
  const radius = node.highlighted ? 14 : 11;
  const labelWidth = nodeLabelWidth(node.name);
  node.x = clamp(
    node.x,
    radius + 16,
    GRAPH_WIDTH - NODE_LABEL_GAP - labelWidth - 16,
  );
  node.y = clamp(node.y, 34, GRAPH_HEIGHT - 34);
};

const createGraph = (entity: string, relations: Relation[]): GraphState => {
  const visibleRelations = relations.slice(0, 12);
  const names = Array.from(
    new Set(
      visibleRelations
        .flatMap((item) => [item.source, item.target])
        .concat(entity ? [entity] : [])
        .map((item) => item?.trim())
        .filter(Boolean),
    ),
  );
  const centerX = GRAPH_WIDTH / 2;
  const centerY = GRAPH_HEIGHT / 2;
  const nodes = names.map((name, index) => {
    const angle = (index / Math.max(names.length, 1)) * Math.PI * 2;
    const highlighted = name === entity;
    return {
      name,
      x: centerX + Math.cos(angle) * (highlighted ? 0 : 205),
      y: centerY + Math.sin(angle) * (highlighted ? 0 : 138),
      vx: 0,
      vy: 0,
      color: getNodeColor(name, highlighted),
      highlighted,
    };
  });
  const nodeMap = new Map(nodes.map((node) => [node.name, node]));
  const edges = visibleRelations
    .map((item) => {
      const sourceNode = nodeMap.get(item.source);
      const targetNode = nodeMap.get(item.target);
      if (!sourceNode || !targetNode) return null;
      return { ...item, sourceNode, targetNode };
    })
    .filter(Boolean) as GraphEdge[];

  return {
    nodes,
    edges,
    hiddenCount: Math.max(0, relations.length - visibleRelations.length),
  };
};

const cloneGraph = (graph: GraphState): GraphState => {
  const nodes = graph.nodes.map((node) => ({ ...node }));
  const nodeMap = new Map(nodes.map((node) => [node.name, node]));
  const edges = graph.edges.map((edge) => ({
    ...edge,
    sourceNode: nodeMap.get(edge.source)!,
    targetNode: nodeMap.get(edge.target)!,
  }));
  return { nodes, edges, hiddenCount: graph.hiddenCount };
};

const segmentsIntersect = (a: GraphEdge, b: GraphEdge) => {
  const shared =
    a.source === b.source ||
    a.source === b.target ||
    a.target === b.source ||
    a.target === b.target;
  if (shared) return false;

  const ccw = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number,
  ) => (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);
  const a1 = a.sourceNode;
  const a2 = a.targetNode;
  const b1 = b.sourceNode;
  const b2 = b.targetNode;

  return (
    ccw(a1.x, a1.y, b1.x, b1.y, b2.x, b2.y) !==
      ccw(a2.x, a2.y, b1.x, b1.y, b2.x, b2.y) &&
    ccw(a1.x, a1.y, a2.x, a2.y, b1.x, b1.y) !==
      ccw(a1.x, a1.y, a2.x, a2.y, b2.x, b2.y)
  );
};

const tickGraph = (graph: GraphState, pinnedNodeName?: string) => {
  const { nodes, edges } = graph;
  const centerX = GRAPH_WIDTH / 2;
  const centerY = GRAPH_HEIGHT / 2;

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i];
      const b = nodes[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let distanceSq = dx * dx + dy * dy;
      if (distanceSq < 1) {
        dx = 1;
        dy = 1;
        distanceSq = 2;
      }
      const distance = Math.sqrt(distanceSq);
      const force = 7200 / Math.max(distanceSq, 1200);
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;
      if (a.name !== pinnedNodeName) {
        a.vx -= fx;
        a.vy -= fy;
      }
      if (b.name !== pinnedNodeName) {
        b.vx += fx;
        b.vy += fy;
      }

      const aBox = getNodeBounds(a);
      const bBox = getNodeBounds(b);
      const overlapX =
        Math.min(aBox.right, bBox.right) - Math.max(aBox.left, bBox.left);
      const overlapY =
        Math.min(aBox.bottom, bBox.bottom) - Math.max(aBox.top, bBox.top);
      if (overlapX > 0 && overlapY > 0) {
        const boxDx = bBox.centerX - aBox.centerX || 1;
        const boxDy = bBox.centerY - aBox.centerY || 1;
        const boxDistance = Math.max(
          1,
          Math.sqrt(boxDx * boxDx + boxDy * boxDy),
        );
        const push = Math.min(18, Math.max(overlapX, overlapY) * 0.48);
        const pushX = (boxDx / boxDistance) * push;
        const pushY = (boxDy / boxDistance) * push;
        if (a.name !== pinnedNodeName) {
          a.vx -= pushX;
          a.vy -= pushY;
        }
        if (b.name !== pinnedNodeName) {
          b.vx += pushX;
          b.vy += pushY;
        }
      }
    }
  }

  edges.forEach((edge) => {
    const dx = edge.targetNode.x - edge.sourceNode.x;
    const dy = edge.targetNode.y - edge.sourceNode.y;
    const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const desired = 210;
    const force = (distance - desired) * 0.032;
    const fx = (dx / distance) * force;
    const fy = (dy / distance) * force;
    if (edge.sourceNode.name !== pinnedNodeName) {
      edge.sourceNode.vx += fx;
      edge.sourceNode.vy += fy;
    }
    if (edge.targetNode.name !== pinnedNodeName) {
      edge.targetNode.vx -= fx;
      edge.targetNode.vy -= fy;
    }
  });

  for (let i = 0; i < edges.length; i += 1) {
    for (let j = i + 1; j < edges.length; j += 1) {
      const a = edges[i];
      const b = edges[j];
      if (!segmentsIntersect(a, b)) continue;

      const ax = (a.sourceNode.x + a.targetNode.x) / 2;
      const ay = (a.sourceNode.y + a.targetNode.y) / 2;
      const bx = (b.sourceNode.x + b.targetNode.x) / 2;
      const by = (b.sourceNode.y + b.targetNode.y) / 2;
      const dx = bx - ax || 1;
      const dy = by - ay || 1;
      const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const pushX = (dx / distance) * 3.2;
      const pushY = (dy / distance) * 3.2;
      [a.sourceNode, a.targetNode].forEach((node) => {
        if (node.name === pinnedNodeName) return;
        node.vx -= pushX;
        node.vy -= pushY;
      });
      [b.sourceNode, b.targetNode].forEach((node) => {
        if (node.name === pinnedNodeName) return;
        node.vx += pushX;
        node.vy += pushY;
      });
    }
  }

  nodes.forEach((node) => {
    if (node.name === pinnedNodeName) {
      node.vx = 0;
      node.vy = 0;
      keepNodeInsideCanvas(node);
      return;
    }
    const gravity = node.highlighted ? 0.055 : 0.008;
    node.vx += (centerX - node.x) * gravity;
    node.vy += (centerY - node.y) * gravity;
    node.vx *= 0.74;
    node.vy *= 0.74;
    node.x += node.vx;
    node.y += node.vy;
    keepNodeInsideCanvas(node);
  });
};

const useSpringGraph = (entity: string, relations: Relation[]) => {
  const initialGraph = useMemo(
    () => createGraph(entity, relations),
    [entity, relations],
  );
  const graphRef = useRef<GraphState>(cloneGraph(initialGraph));
  const pinnedNodeRef = useRef<string>('');
  const [graph, setGraph] = useState<GraphState>(() =>
    cloneGraph(initialGraph),
  );

  useEffect(() => {
    let frame = 0;
    const graphState = cloneGraph(initialGraph);
    graphRef.current = graphState;
    let tick = 0;

    const animate = () => {
      tickGraph(graphState, pinnedNodeRef.current);
      tick += 1;
      if (tick % 2 === 0) {
        setGraph(cloneGraph(graphState));
      }
      frame = requestAnimationFrame(animate);
    };

    setGraph(cloneGraph(graphState));
    frame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frame);
  }, [initialGraph]);

  const setNodePosition = (name: string, x: number, y: number) => {
    pinnedNodeRef.current = name;
    const node = graphRef.current.nodes.find((item) => item.name === name);
    if (!node) return;
    node.x = x;
    node.y = y;
    node.vx = 0;
    node.vy = 0;
    keepNodeInsideCanvas(node);
    setGraph(cloneGraph(graphRef.current));
  };

  const releaseNode = () => {
    pinnedNodeRef.current = '';
  };

  return { graph, setNodePosition, releaseNode };
};

export function KnowledgeGraphReferencePreview({
  content,
}: {
  content?: string | null;
}) {
  const markerId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const parsed = parseKnowledgeGraphContent(content ?? '');
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingNodeRef = useRef<string>('');
  const { graph, setNodePosition, releaseNode } = useSpringGraph(
    parsed.entity,
    parsed.relations,
  );
  const [selectedEdgeKey, setSelectedEdgeKey] = useState<string>('');

  const getSvgPoint = (event: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = svg.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const transformed = point.matrixTransform(matrix.inverse());
    return { x: transformed.x, y: transformed.y };
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!draggingNodeRef.current) return;
    const point = getSvgPoint(event);
    setNodePosition(draggingNodeRef.current, point.x, point.y);
  };

  const handlePointerUp = (event: PointerEvent<SVGSVGElement>) => {
    if (!draggingNodeRef.current) return;
    svgRef.current?.releasePointerCapture(event.pointerId);
    draggingNodeRef.current = '';
    releaseNode();
  };

  if (!parsed.entity && !parsed.relations.length) {
    return <div className="text-sm text-text-secondary">{content}</div>;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-blue-100 bg-blue-50/70 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-white">
            <Network size={16} />
          </div>
          <div className="font-medium text-slate-900">{parsed.entity}</div>
          {parsed.type && (
            <span className="rounded bg-white px-2 py-0.5 text-xs text-slate-600">
              {parsed.type}
            </span>
          )}
          {parsed.similarity && (
            <span className="rounded bg-white px-2 py-0.5 text-xs text-blue-700">
              similarity {parsed.similarity}
            </span>
          )}
        </div>
        {parsed.description && (
          <div className="mt-2 text-sm leading-6 text-slate-700">
            {parsed.description}
          </div>
        )}
      </div>

      {graph.edges.length > 0 && (
        <div className="rounded-md border border-slate-200 bg-white p-2">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Subgraph</span>
            {graph.hiddenCount > 0 && <span>+{graph.hiddenCount} more</span>}
          </div>
          <div className="overflow-auto rounded bg-slate-50">
            <svg
              ref={svgRef}
              width={GRAPH_WIDTH}
              height={GRAPH_HEIGHT}
              viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
              className="min-w-[680px]"
              onClick={() => setSelectedEdgeKey('')}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              <defs>
                <marker
                  id={`kg-arrow-${markerId}`}
                  markerWidth="10"
                  markerHeight="10"
                  refX="8"
                  refY="3"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M0,0 L0,6 L9,3 z" fill="#94a3b8" />
                </marker>
              </defs>
              <rect width={GRAPH_WIDTH} height={GRAPH_HEIGHT} fill="#f8fafc" />

              {graph.edges.map((edge, index) => {
                const midX = (edge.sourceNode.x + edge.targetNode.x) / 2;
                const midY = (edge.sourceNode.y + edge.targetNode.y) / 2;
                const edgeKey = `${edge.source}-${edge.target}-${edge.relation}-${index}`;
                const selected = selectedEdgeKey === edgeKey;
                const label = truncate(edge.relation || 'related', 14);
                const labelWidth = Math.min(
                  126,
                  Math.max(52, label.length * 9 + 16),
                );

                return (
                  <g key={edgeKey}>
                    <line
                      x1={edge.sourceNode.x}
                      y1={edge.sourceNode.y}
                      x2={edge.targetNode.x}
                      y2={edge.targetNode.y}
                      stroke={selected ? '#2563eb' : '#cbd5e1'}
                      strokeWidth={selected ? '2.2' : '1.6'}
                      markerEnd={`url(#kg-arrow-${markerId})`}
                    />
                    <line
                      x1={edge.sourceNode.x}
                      y1={edge.sourceNode.y}
                      x2={edge.targetNode.x}
                      y2={edge.targetNode.y}
                      stroke="transparent"
                      strokeWidth="14"
                      className="cursor-pointer"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedEdgeKey((current) =>
                          current === edgeKey ? '' : edgeKey,
                        );
                      }}
                    />
                    {selected && (
                      <g>
                        <rect
                          x={midX - labelWidth / 2}
                          y={midY - 18}
                          width={labelWidth}
                          height="24"
                          rx="5"
                          fill="rgba(255,255,255,0.96)"
                          stroke="#bfdbfe"
                        />
                        <text
                          x={midX}
                          y={midY - 2}
                          textAnchor="middle"
                          className="fill-blue-700 text-[10px] font-medium"
                        >
                          {label}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {graph.nodes.map((node) => (
                <g
                  key={node.name}
                  className="cursor-grab active:cursor-grabbing"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    draggingNodeRef.current = node.name;
                    svgRef.current?.setPointerCapture(event.pointerId);
                    const point = getSvgPoint(event);
                    setNodePosition(node.name, point.x, point.y);
                  }}
                >
                  {node.highlighted && (
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r="32"
                      fill={`${node.color}18`}
                    />
                  )}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.highlighted ? 14 : 11}
                    fill={node.color}
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  <rect
                    x={node.x + 15}
                    y={node.y - 12}
                    width={nodeLabelWidth(node.name)}
                    height="24"
                    rx="5"
                    fill="rgba(255,255,255,0.94)"
                    stroke="#e2e8f0"
                  />
                  <text
                    x={node.x + 23}
                    y={node.y + 4}
                    textAnchor="start"
                    className="fill-slate-800 text-[11px] font-medium"
                  >
                    {truncate(node.name, 12)}
                  </text>
                  <title>{node.name}</title>
                </g>
              ))}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
