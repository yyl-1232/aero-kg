import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Authorization } from '@/constants/authorization';
import { getAuthorization } from '@/utils/authorization-util';
import { X } from 'lucide-react';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ManualGraphEditor } from './manual-graph-editor';
interface GraphDisplayProps {
  kbId: string;
  kbData: any;
}
interface Node {
  id: number;
  entity_name: string;
  entity_type: string;
  description: string;
  pagerank: number;
  communities: any[];
  source: string[];
  aliases?: string[];
}

interface Edge {
  id?: string;
  source: number;
  target: number;
  relation: string;
  relation_description?: string;
  description: string;
  weight: number;
  source_detail?: string[];
  mergedEdges?: Edge[];
}

interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

interface NodePosition {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const EMPTY_GRAPH: GraphData = { nodes: [], edges: [] };

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

const TYPE_COLORS = [
  '#2563eb', // 1. 蓝色
  '#dc2626', // 2. 红色
  '#059669', // 3. 翠绿
  '#d97706', // 4. 琥珀
  '#7c3aed', // 5. 紫色
  '#0891b2', // 6. 青色
  '#be123c', // 7. 玫红
  '#65a30d', // 8. 柠绿
  '#ea580c', // 9. 橙色
  '#0d9488', // 10. 蓝绿
  '#c026d3', // 11. 品红
  '#4f46e5', // 12. 靛蓝
  '#16a34a', // 13. 绿色
  '#9333ea', // 14. 紫罗兰
  '#b45309', // 15. 棕橙
  '#0284c7', // 16. 天蓝
  '#ca8a04', // 17. 黄色
  '#9f1239', // 18. 酒红
  '#4d7c0f', // 19. 橄榄绿
  '#6d28d9', // 20. 深紫
  '#f97316', // 21. 亮橙
  '#14b8a6', // 22. 薄荷绿
  '#e11d48', // 23. 粉红
  '#0369a1', // 24. 深天蓝
  '#a21caf', // 25. 兰花紫
  '#84cc16', // 26. 浅绿
  '#ec4899', // 27. 桃粉
  '#1e40af', // 28. 宝蓝
  '#854d0e', // 29. 棕色
  '#10b981', // 30. 碧绿
];

// 运行时颜色分配缓存：按类型首次出现顺序依次分配颜色，保证不同类型绝不撞色
const _typeColorCache = new Map<string, string>();
let _nextColorIndex = 0;

function getNodeColor(type?: string) {
  const normalized = (type || 'Entity').trim().toLowerCase();

  // 已缓存过则直接返回
  const cached = _typeColorCache.get(normalized);
  if (cached) return cached;

  // 按顺序分配 TYPE_COLORS 中的颜色，30 种用完后循环复用（加偏移避免完全重叠）
  const color = TYPE_COLORS[_nextColorIndex % TYPE_COLORS.length];
  _typeColorCache.set(normalized, color);
  _nextColorIndex++;

  return color;
}

function truncateText(text: string, max = 18) {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

const DEFAULT_EDGE_CURVATURE = 0.15;

function getEdgeGroupKey(edge: Edge) {
  return `${edge.source}->${edge.target}`;
}

function uniqueNonEmpty(values: Array<string | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]),
  );
}

function getEdgeDescription(edge?: Edge | null) {
  const relationDescription = edge?.relation_description?.trim();
  if (relationDescription) return relationDescription;

  const description = edge?.description?.trim();
  if (!description || description === edge?.relation?.trim()) return '';

  return description;
}

function mergeEdgesForDisplay(edges: Edge[]) {
  const groups = new Map<string, Edge[]>();

  edges.forEach((edge) => {
    const key = getEdgeGroupKey(edge);
    const group = groups.get(key);
    if (group) {
      group.push(edge);
    } else {
      groups.set(key, [edge]);
    }
  });

  return Array.from(groups.entries()).map(([key, group]) => {
    if (group.length === 1) return group[0];

    const [first] = group;
    const relations = uniqueNonEmpty(group.map((edge) => edge.relation));
    const descriptions = uniqueNonEmpty(group.map(getEdgeDescription));
    const sourceDetails = uniqueNonEmpty(
      group.flatMap((edge) => edge.source_detail || []),
    );
    const totalWeight = group.reduce(
      (sum, edge) => sum + (typeof edge.weight === 'number' ? edge.weight : 0),
      0,
    );

    return {
      ...first,
      id: `merged:${key}`,
      relation: relations.join(' / '),
      relation_description: descriptions.join('\n'),
      description: descriptions.join('\n'),
      source_detail: sourceDetails,
      weight: totalWeight / group.length,
      mergedEdges: group,
    };
  });
}

function getQuadraticControlPoint(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  curvature: number,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  return {
    x: midX - dy * curvature,
    y: midY + dx * curvature,
  };
}

function getQuadraticPoint(
  x1: number,
  y1: number,
  cx: number,
  cy: number,
  x2: number,
  y2: number,
  t: number,
) {
  const oneMinusT = 1 - t;
  return {
    x: oneMinusT * oneMinusT * x1 + 2 * oneMinusT * t * cx + t * t * x2,
    y: oneMinusT * oneMinusT * y1 + 2 * oneMinusT * t * cy + t * t * y2,
  };
}

function getPointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);

  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lenSq, 0, 1);
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

// 绘制曲线箭头
function drawCurvedArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  curvature: number = 0.15,
  arrowSize: number = 8,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 1) return;

  const control = getQuadraticControlPoint(x1, y1, x2, y2, curvature);

  // 绘制曲线
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(control.x, control.y, x2, y2);
  ctx.stroke();

  // 在终点绘制箭头
  const angle = Math.atan2(y2 - control.y, x2 - control.x);

  ctx.save();
  ctx.translate(x2, y2);
  ctx.rotate(angle);

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-arrowSize, -arrowSize / 2);
  ctx.lineTo(-arrowSize, arrowSize / 2);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// ===== 图结构辅助函数 =====

// 构建邻接表
function buildAdjacencyList(nodes: Node[], links: Edge[]) {
  const adj = new Map<number, number[]>();
  nodes.forEach((n) => adj.set(n.id, []));
  links.forEach((l) => {
    const s = adj.get(l.source);
    const t = adj.get(l.target);
    if (s && !s.includes(l.target)) s.push(l.target);
    if (t && !t.includes(l.source)) t.push(l.source);
  });
  return adj;
}

// 查找连通分量（按大小降序）
function findConnectedComponents(
  nodes: Node[],
  adj: Map<number, number[]>,
): number[][] {
  const visited = new Set<number>();
  const components: number[][] = [];

  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    const component: number[] = [];
    const stack = [node.id];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      component.push(current);
      for (const neighbor of adj.get(current) || []) {
        if (!visited.has(neighbor)) stack.push(neighbor);
      }
    }
    components.push(component);
  }

  return components.sort((a, b) => b.length - a.length);
}

// BFS树形布局：从最高度数节点出发，每个分支占据独立角度扇区
function bfsTreeLayout(
  componentIds: number[],
  adj: Map<number, number[]>,
  linkDistance: number,
  center: { x: number; y: number },
): Map<number, NodePosition> {
  const positions = new Map<number, NodePosition>();
  if (componentIds.length === 0) return positions;

  const idSet = new Set(componentIds);

  // 找最高度数节点作为根
  let rootId = componentIds[0];
  let maxDeg = 0;
  for (const id of componentIds) {
    const deg = (adj.get(id) || []).filter((n) => idSet.has(n)).length;
    if (deg > maxDeg) {
      maxDeg = deg;
      rootId = id;
    }
  }

  // 根节点放在中心
  positions.set(rootId, { x: center.x, y: center.y, vx: 0, vy: 0 });

  // BFS队列，每个节点带有角度扇区信息
  const visited = new Set<number>([rootId]);
  const queue: Array<{
    id: number;
    depth: number;
    angleStart: number;
    angleEnd: number;
  }> = [{ id: rootId, depth: 0, angleStart: 0, angleEnd: 2 * Math.PI }];

  while (queue.length > 0) {
    const { id, depth, angleStart, angleEnd } = queue.shift()!;
    const neighbors = (adj.get(id) || []).filter(
      (n) => !visited.has(n) && idSet.has(n),
    );

    if (neighbors.length === 0) continue;

    const nextDepth = depth + 1;
    const radius = nextDepth * linkDistance;
    const angleRange = angleEnd - angleStart;
    const angleStep = angleRange / neighbors.length;

    for (let i = 0; i < neighbors.length; i++) {
      const neighborId = neighbors[i];
      visited.add(neighborId);

      // 放在角度扇区的中心
      const angle = angleStart + angleStep * (i + 0.5);
      const x = center.x + radius * Math.cos(angle);
      const y = center.y + radius * Math.sin(angle);

      positions.set(neighborId, { x, y, vx: 0, vy: 0 });

      // 每个子节点继承自己的角度扇区
      queue.push({
        id: neighborId,
        depth: nextDepth,
        angleStart: angleStart + angleStep * i,
        angleEnd: angleStart + angleStep * (i + 1),
      });
    }
  }

  return positions;
}

function InteractiveForceGraph({
  data,
  selectedNode,
  selectedEdge,
  onNodeSelect,
  onEdgeSelect,
  focusNodeId,
  inheritedPositions,
  onPositionsReady,
}: {
  data: { nodes: Node[]; links: Edge[] };
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  onNodeSelect: (node: Node | null) => void;
  onEdgeSelect: (edge: Edge | null) => void;
  focusNodeId?: number | null; // 搜索子图时，以该节点为核心居中
  inheritedPositions?: Map<number, NodePosition> | null; // 从父图谱继承的节点位置（避免重新仿真）
  onPositionsReady?: (positions: Map<number, NodePosition>) => void; // 位置变化时通知父组件
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 600 });
  const canvasSizeRef = useRef(canvasSize);
  canvasSizeRef.current = canvasSize;

  const [nodePositions, setNodePositions] = useState<Map<number, NodePosition>>(
    new Map(),
  );
  const [draggedNode, setDraggedNode] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<Edge | null>(null);
  const animationRef = useRef<number>();

  // ===== 视口变换：虚拟坐标 → 屏幕坐标 =====
  // screenX = virtualX * scale + offsetX
  // screenY = virtualY * scale + offsetY
  const [viewport, setViewport] = useState({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  // 平移状态
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });

  // 仿真收敛跟踪
  const simConvergedRef = useRef(false);
  const simFrameRef = useRef(0);
  const autoFittedRef = useRef(false);
  const focusCenteredAfterSimRef = useRef(false);

  const NODE_BASE_RADIUS = 12;
  const NODE_HOVER_RADIUS = 17;
  const NODE_SELECTED_RADIUS = 21;

  const PADDING = 40;

  const displayLinks = useMemo(
    () => mergeEdgesForDisplay(data.links),
    [data.links],
  );

  // 邻接表（用于BFS树形布局）
  const adjacencyList = useMemo(
    () => buildAdjacencyList(data.nodes, data.links),
    [data.nodes, data.links],
  );

  // ===== 基于节点+边数量的自适应力导向参数 =====
  // 核心改变：大间距 + 强斥力 + 零中心力 → 不形成圆形点云
  const forceParams = useMemo(() => {
    const n = Math.max(1, data.nodes.length);
    const e = Math.max(1, displayLinks.length);

    // 斥力：节点越多越强，确保互相推开
    // 128节点: 300, 1000节点: 1200
    const repulsionForce = 300 * Math.pow(n / 128, 0.6);

    // 连线距离：200px，大间距让不同分支明确分开
    const linkDistance = 200;

    // 中心力：完全为0，不收拢节点，不形成圆形
    const centerForce = 0;

    // 碰撞半径：40px，物理层面杜绝节点重叠
    const collideRadius = 40;

    // 弹簧系数：适中
    const springK = 0.04;

    return {
      repulsionForce,
      linkDistance,
      centerForce,
      collideRadius,
      springK,
      nodeCount: n,
      edgeCount: e,
    };
  }, [data.nodes.length, displayLinks.length]);

  // ===== 虚拟坐标 ↔ 屏幕坐标 转换 =====
  const toScreen = useCallback(
    (vx: number, vy: number) => ({
      x: vx * viewportRef.current.scale + viewportRef.current.offsetX,
      y: vy * viewportRef.current.scale + viewportRef.current.offsetY,
    }),
    [],
  );

  const toVirtual = useCallback(
    (sx: number, sy: number) => ({
      x: (sx - viewportRef.current.offsetX) / viewportRef.current.scale,
      y: (sy - viewportRef.current.offsetY) / viewportRef.current.scale,
    }),
    [],
  );

  // 用户是否手动操作过视口（缩放/平移），手动操作后不再自动适配
  const userInteractedRef = useRef(false);

  // ===== 居中到连接数最多的节点：仅平移视口，不改缩放 =====
  const centerOnHubNode = useCallback(
    (positions: Map<number, NodePosition>) => {
      if (positions.size === 0) return;

      // 统计每个节点的连接数（度数）
      const degreeMap = new Map<number, number>();
      displayLinks.forEach((link) => {
        degreeMap.set(link.source, (degreeMap.get(link.source) || 0) + 1);
        degreeMap.set(link.target, (degreeMap.get(link.target) || 0) + 1);
      });

      // 找到连接数最多的节点
      let hubId: number | null = null;
      let maxDegree = -1;
      degreeMap.forEach((deg, id) => {
        if (deg > maxDegree && positions.has(id)) {
          maxDegree = deg;
          hubId = id;
        }
      });

      // 如果没有边，就找第一个节点
      if (hubId === null) {
        const firstEntry = positions.entries().next();
        if (firstEntry.done) return;
        hubId = firstEntry.value[0];
      }

      const hubPos = positions.get(hubId);
      if (!hubPos) return;

      const { width, height } = canvasSizeRef.current;
      const scale = viewportRef.current.scale;

      // 只调整偏移，将连接数最多的节点放到屏幕中间，保持当前缩放不变
      const offsetX = width / 2 - hubPos.x * scale;
      const offsetY = height / 2 - hubPos.y * scale;

      setViewport((prev) => ({ ...prev, offsetX, offsetY }));
    },
    [displayLinks],
  );

  // ===== 自动适配视口：计算缩放+偏移使所有节点可见 =====
  const autoFitViewport = useCallback(
    (positions?: Map<number, NodePosition>, force = false) => {
      // 如果用户已手动操作视口，且非强制适配，则跳过自动适配
      if (userInteractedRef.current && !force) return;

      const pos = positions || nodePositions;
      if (pos.size === 0) return;

      const { width, height } = canvasSizeRef.current;
      const pad = 80;

      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      pos.forEach((p) => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      });

      const gw = maxX - minX || 1;
      const gh = maxY - minY || 1;

      const scaleX = (width - pad * 2) / gw;
      const scaleY = (height - pad * 2) / gh;

      // 关键：设置最小缩放比例，防止大图被压缩成一小团
      // 最小0.3意味着节点在屏幕上至少有原始大小的30%
      const MIN_SCALE = 0.3;
      const scale = clamp(Math.min(scaleX, scaleY), MIN_SCALE, 2);

      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;

      const offsetX = width / 2 - cx * scale;
      const offsetY = height / 2 - cy * scale;

      setViewport({ scale, offsetX, offsetY });
      autoFittedRef.current = true;
    },
    [nodePositions],
  );

  // 画布自适应父容器
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (!canvasRef.current) return;
        const w = Math.max(300, width);
        const h = Math.max(300, height);
        canvasRef.current.width = w;
        canvasRef.current.height = h;
        setCanvasSize({ width: w, height: h });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // 窗口大小变化时不再自动缩放，保持收敛时的原始展示
  // 用户可通过"适配全图"按钮手动触发

  // ===== 初始化节点位置：优先复用继承位置，否则 BFS树形布局 + 连通分量分离 =====
  useEffect(() => {
    if (data.nodes.length === 0) return;

    // 如果有继承的位置，尽可能复用已有节点位置（支持部分复用，加速子图收敛）
    if (inheritedPositions && inheritedPositions.size > 0) {
      const reused = new Map<number, NodePosition>();
      let allFound = true;
      for (const node of data.nodes) {
        const pos = inheritedPositions.get(node.id);
        if (pos) {
          reused.set(node.id, { ...pos, vx: 0, vy: 0 });
        } else {
          allFound = false;
          break;
        }
      }
      if (allFound) {
        setNodePositions(reused);
        simConvergedRef.current = true; // 直接标记收敛，跳过力导向仿真
        simFrameRef.current = 0;
        autoFittedRef.current = false;
        focusCenteredAfterSimRef.current = false;
        if (focusNodeId != null && reused.has(focusNodeId)) {
          const focusPos = reused.get(focusNodeId)!;
          const { width, height } = canvasSizeRef.current;
          const scale = viewportRef.current.scale;
          const offsetX = width / 2 - focusPos.x * scale;
          const offsetY = height / 2 - focusPos.y * scale;
          setViewport((prev) => ({ ...prev, offsetX, offsetY }));
          const focusNode = data.nodes.find((n) => n.id === focusNodeId);
          if (focusNode) onNodeSelect(focusNode);
        } else {
          centerOnHubNode(reused);
        }
        return;
      }
    }

    const { linkDistance } = forceParams;
    const positions = new Map<number, NodePosition>();

    // 查找连通分量
    const components = findConnectedComponents(data.nodes, adjacencyList);

    // 不同连通分量放置在不同区域
    // 用网格布局分离各分量，而非全部堆在同一点
    const compCount = components.length;
    const compGridCols = Math.ceil(Math.sqrt(compCount));
    const compSpacing = linkDistance * 3; // 分量间距

    components.forEach((comp, compIdx) => {
      // 计算该分量在网格中的位置
      const gridRow = Math.floor(compIdx / compGridCols);
      const gridCol = compIdx % compGridCols;
      const compCenterX = gridCol * compSpacing;
      const compCenterY = gridRow * compSpacing;

      if (comp.length === 1) {
        // 孤立节点
        positions.set(comp[0], {
          x: compCenterX,
          y: compCenterY,
          vx: 0,
          vy: 0,
        });
      } else {
        // BFS树形布局：每个分支占独立角度扇区
        const compPositions = bfsTreeLayout(comp, adjacencyList, linkDistance, {
          x: compCenterX,
          y: compCenterY,
        });
        compPositions.forEach((pos, id) => {
          positions.set(id, pos);
        });
      }
    });

    setNodePositions(positions);
    simConvergedRef.current = false;
    simFrameRef.current = 0;
    autoFittedRef.current = false;
    focusCenteredAfterSimRef.current = false;
    // 初始化时居中显示：优先以搜索实体为核心，否则以连接数最多的节点为核心
    if (focusNodeId != null && positions.has(focusNodeId)) {
      const focusPos = positions.get(focusNodeId)!;
      const { width, height } = canvasSizeRef.current;
      const scale = viewportRef.current.scale;
      const offsetX = width / 2 - focusPos.x * scale;
      const offsetY = height / 2 - focusPos.y * scale;
      setViewport((prev) => ({ ...prev, offsetX, offsetY }));
      // 同时选中该节点
      const focusNode = data.nodes.find((n) => n.id === focusNodeId);
      if (focusNode) onNodeSelect(focusNode);
    } else {
      centerOnHubNode(positions);
    }
  }, [
    data.nodes,
    data.links,
    adjacencyList,
    forceParams,
    centerOnHubNode,
    focusNodeId,
  ]);

  // ===== 力导向仿真：自适应参数 + 无边界约束 =====
  useEffect(() => {
    if (nodePositions.size === 0) return;

    const {
      repulsionForce,
      linkDistance,
      centerForce,
      collideRadius,
      springK,
      nodeCount,
    } = forceParams;

    // 计算图的质心
    let cx = 0,
      cy = 0;
    nodePositions.forEach((p) => {
      cx += p.x;
      cy += p.y;
    });
    cx /= nodeCount;
    cy /= nodeCount;

    const damping = 0.85;
    const minDist = collideRadius * 2; // 80px 碰撞隔离距离
    const pushApart = 0.8; // 碰撞推力强度

    // 最大迭代次数：节点越多需要更多迭代才能收敛
    const maxIterations = Math.max(500, nodeCount * 2);

    const simulate = () => {
      simFrameRef.current++;
      const newPositions = new Map(nodePositions);
      let maxMove = 0;

      // 1) 全局斥力：所有节点对都计算（同 D3 forceManyBody）
      // 不截断远距离节点，确保整个图被推开，不会聚拢成圆形
      data.nodes.forEach((n1) => {
        const p1 = newPositions.get(n1.id);
        if (!p1) return;

        for (let j = 0; j < data.nodes.length; j++) {
          const n2 = data.nodes[j];
          if (n1.id === n2.id) continue;
          const p2 = newPositions.get(n2.id);
          if (!p2) continue;

          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const safeDist = Math.max(8, dist);

          // D3 forceManyBody 模型：斥力 = strength / dist²
          const force = repulsionForce / (safeDist * safeDist);
          p1.vx += (dx / safeDist) * force;
          p1.vy += (dy / safeDist) * force;
        }

        // 极弱中心力（同 D3 forceCenter）：仅防漂移，不压缩
        p1.vx += (cx - p1.x) * centerForce;
        p1.vy += (cy - p1.y) * centerForce;
      });

      // 2) 边的弹簧力：连接的节点互相吸引
      displayLinks.forEach((link) => {
        const p1 = newPositions.get(link.source);
        const p2 = newPositions.get(link.target);
        if (!p1 || !p2) return;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        const delta = dist - linkDistance;
        const force = delta * springK;

        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        p1.vx += fx;
        p1.vy += fy;
        p2.vx -= fx;
        p2.vy -= fy;
      });

      // 3) 碰撞分离：防止节点重叠
      for (let i = 0; i < data.nodes.length; i++) {
        const a = data.nodes[i];
        const pa = newPositions.get(a.id);
        if (!pa || draggedNode === a.id) continue;

        for (let j = i + 1; j < data.nodes.length; j++) {
          const b = data.nodes[j];
          const pb = newPositions.get(b.id);
          if (!pb || draggedNode === b.id) continue;

          const dx = pb.x - pa.x;
          const dy = pb.y - pa.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < minDist * minDist) {
            const dist = Math.sqrt(distSq) || 1;
            const overlap = (minDist - dist) / dist;
            const ox = dx * overlap * pushApart;
            const oy = dy * overlap * pushApart;

            pa.x -= ox * 0.5;
            pa.y -= oy * 0.5;
            pb.x += ox * 0.5;
            pb.y += oy * 0.5;

            pa.vx *= 0.85;
            pa.vy *= 0.85;
            pb.vx *= 0.85;
            pb.vy *= 0.85;
          }
        }
      }

      // 4) 更新位置（无硬边界约束，节点在虚拟空间自由移动）
      data.nodes.forEach((node) => {
        const pos = newPositions.get(node.id);
        if (!pos || draggedNode === node.id) return;

        pos.vx *= damping;
        pos.vy *= damping;
        pos.x += pos.vx;
        pos.y += pos.vy;

        maxMove = Math.max(maxMove, Math.abs(pos.vx) + Math.abs(pos.vy));
      });

      setNodePositions(newPositions);

      if (maxMove > 0.05 && simFrameRef.current < maxIterations) {
        animationRef.current = requestAnimationFrame(simulate);
      } else {
        simConvergedRef.current = true;

        // 仿真收敛后，如果有焦点节点且尚未居中，则将焦点节点居中显示
        if (
          focusNodeId != null &&
          !focusCenteredAfterSimRef.current &&
          !userInteractedRef.current
        ) {
          const focusPos = newPositions.get(focusNodeId);
          if (focusPos) {
            const { width, height } = canvasSizeRef.current;
            const scale = viewportRef.current.scale;
            const offsetX = width / 2 - focusPos.x * scale;
            const offsetY = height / 2 - focusPos.y * scale;
            setViewport((prev) => ({ ...prev, offsetX, offsetY }));
            focusCenteredAfterSimRef.current = true;
          }
        }
      }
    };

    animationRef.current = requestAnimationFrame(simulate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [
    data.nodes,
    displayLinks,
    nodePositions,
    draggedNode,
    forceParams,
    focusNodeId,
  ]);

  // ===== 绘制：视口变换 + 裁剪优化 =====
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvasSize;
    const vp = viewportRef.current;

    ctx.clearRect(0, 0, width, height);
    ctx.save();

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    // 背景网格
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.6;
    const gridStep = 32;
    // 根据视口偏移绘制网格
    const startGX = Math.floor(-vp.offsetX / (gridStep * vp.scale)) * gridStep;
    const startGY = Math.floor(-vp.offsetY / (gridStep * vp.scale)) * gridStep;
    const endGX =
      Math.ceil((width - vp.offsetX) / (gridStep * vp.scale)) * gridStep;
    const endGY =
      Math.ceil((height - vp.offsetY) / (gridStep * vp.scale)) * gridStep;
    for (let gx = startGX; gx <= endGX; gx += gridStep) {
      const sx = gx * vp.scale + vp.offsetX;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, height);
      ctx.stroke();
    }
    for (let gy = startGY; gy <= endGY; gy += gridStep) {
      const sy = gy * vp.scale + vp.offsetY;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(width, sy);
      ctx.stroke();
    }

    ctx.font = '12px sans-serif';

    const selectedId = selectedNode?.id;
    const neighborIds = new Set<number>();
    if (selectedId !== undefined) {
      displayLinks.forEach((link) => {
        if (link.source === selectedId) neighborIds.add(link.target);
        if (link.target === selectedId) neighborIds.add(link.source);
      });
    }

    // 屏幕范围裁剪：只绘制可见区域内的节点和边
    const margin = 100;
    const visMinX = -vp.offsetX / vp.scale - margin;
    const visMinY = -vp.offsetY / vp.scale - margin;
    const visMaxX = (width - vp.offsetX) / vp.scale + margin;
    const visMaxY = (height - vp.offsetY) / vp.scale + margin;

    // 判断虚拟坐标是否在可见区域
    const isVisible = (vx: number, vy: number) =>
      vx >= visMinX && vx <= visMaxX && vy >= visMinY && vy <= visMaxY;

    // 边（曲线箭头）
    displayLinks.forEach((link) => {
      const s = nodePositions.get(link.source);
      const t = nodePositions.get(link.target);
      if (!s || !t) return;

      // 裁剪：两端都不可见则跳过
      if (!isVisible(s.x, s.y) && !isVisible(t.x, t.y)) return;

      // 转换到屏幕坐标
      const ss = toScreen(s.x, s.y);
      const st = toScreen(t.x, t.y);

      const isHovered = hoveredEdge === link;
      const isSelected = selectedEdge === link;
      const isRelatedToSelected =
        selectedId === undefined ||
        link.source === selectedId ||
        link.target === selectedId;

      ctx.strokeStyle = isSelected
        ? '#2563eb'
        : isHovered
          ? '#60a5fa'
          : isRelatedToSelected
            ? '#94a3b8'
            : '#e2e8f0';
      ctx.fillStyle = ctx.strokeStyle;
      ctx.globalAlpha = isRelatedToSelected ? 1 : 0.28;
      ctx.lineWidth = isSelected ? 3 : isHovered ? 2 : 1.2;

      const targetRadius =
        selectedNode?.id === link.target
          ? NODE_SELECTED_RADIUS
          : hoveredNode === link.target
            ? NODE_HOVER_RADIUS
            : NODE_BASE_RADIUS;

      const dx = st.x - ss.x;
      const dy = st.y - ss.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ratio = dist > 0 ? (dist - targetRadius - 2) / dist : 1;

      const endX = ss.x + dx * ratio;
      const endY = ss.y + dy * ratio;
      const curvature = DEFAULT_EDGE_CURVATURE;

      drawCurvedArrow(ctx, ss.x, ss.y, endX, endY, curvature);

      if (isSelected || isHovered) {
        const label = truncateText(link.relation, link.mergedEdges ? 32 : 16);
        const control = getQuadraticControlPoint(
          ss.x,
          ss.y,
          endX,
          endY,
          curvature,
        );
        const labelPoint = getQuadraticPoint(
          ss.x,
          ss.y,
          control.x,
          control.y,
          endX,
          endY,
          0.5,
        );
        const textWidth = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.fillRect(
          labelPoint.x - textWidth / 2 - 6,
          labelPoint.y - 11,
          textWidth + 12,
          22,
        );
        ctx.fillStyle = '#334155';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, labelPoint.x, labelPoint.y);
      }

      ctx.globalAlpha = 1;
    });

    // 节点
    data.nodes.forEach((node) => {
      const pos = nodePositions.get(node.id);
      if (!pos) return;

      // 裁剪：不可见则跳过
      if (!isVisible(pos.x, pos.y)) return;

      // 转换到屏幕坐标
      const sp = toScreen(pos.x, pos.y);

      const isHovered = hoveredNode === node.id;
      const isSelected = selectedNode?.id === node.id;
      const isNeighbor = neighborIds.has(node.id);
      const isDimmed = selectedId !== undefined && !isSelected && !isNeighbor;
      const radius = isSelected
        ? NODE_SELECTED_RADIUS
        : isHovered
          ? NODE_HOVER_RADIUS
          : isNeighbor
            ? NODE_HOVER_RADIUS
            : NODE_BASE_RADIUS;

      const nodeColor = getNodeColor(node.entity_type);
      ctx.globalAlpha = isDimmed ? 0.28 : 1;

      if (isSelected || isHovered) {
        const glow = ctx.createRadialGradient(
          sp.x,
          sp.y,
          radius,
          sp.x,
          sp.y,
          radius + 18,
        );
        glow.addColorStop(0, `${nodeColor}55`);
        glow.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, radius + 18, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(sp.x, sp.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = nodeColor;
      ctx.fill();
      ctx.strokeStyle = isSelected
        ? '#0f172a'
        : isHovered
          ? '#1e293b'
          : 'white';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.stroke();

      // 标签：缩放足够大时才显示，防止缩小时文字拥挤
      if (vp.scale > 0.3) {
        const label = node.entity_name;
        const textWidth = ctx.measureText(label).width;
        const labelX = sp.x + radius + 6;
        const labelY = sp.y;

        ctx.fillStyle = 'rgba(255,255,255,0.94)';
        ctx.fillRect(labelX - 4, labelY - 9, textWidth + 8, 18);

        ctx.fillStyle = '#1e293b';
        ctx.font =
          isSelected || isHovered ? 'bold 13px sans-serif' : '12px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, labelX, labelY);
      }

      ctx.globalAlpha = 1;
    });

    ctx.restore();
  }, [
    data,
    nodePositions,
    hoveredNode,
    hoveredEdge,
    selectedNode,
    selectedEdge,
    displayLinks,
    canvasSize,
    viewport,
    toScreen,
  ]);

  // ===== 命中测试（使用虚拟坐标） =====
  const getNodeAt = useCallback(
    (screenX: number, screenY: number) => {
      const v = toVirtual(screenX, screenY);
      for (const node of data.nodes) {
        const pos = nodePositions.get(node.id);
        if (!pos) continue;
        const dx = v.x - pos.x;
        const dy = v.y - pos.y;
        // 命中半径随缩放调整
        const hitRadius = NODE_SELECTED_RADIUS / viewportRef.current.scale;
        if (Math.sqrt(dx * dx + dy * dy) <= hitRadius) return node;
      }
      return null;
    },
    [data.nodes, nodePositions, toVirtual],
  );

  const getEdgeAt = useCallback(
    (screenX: number, screenY: number) => {
      const vp = viewportRef.current;
      for (const edge of displayLinks) {
        const s = nodePositions.get(edge.source);
        const t = nodePositions.get(edge.target);
        if (!s || !t) continue;

        // 转换到屏幕坐标进行命中测试
        const ss = toScreen(s.x, s.y);
        const st = toScreen(t.x, t.y);

        const dx = st.x - ss.x;
        const dy = st.y - ss.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) continue;

        const endRatio = (len - NODE_BASE_RADIUS - 2) / len;
        const endX = ss.x + dx * endRatio;
        const endY = ss.y + dy * endRatio;
        const curvature = DEFAULT_EDGE_CURVATURE;
        const control = getQuadraticControlPoint(
          ss.x,
          ss.y,
          endX,
          endY,
          curvature,
        );

        let previous = { x: ss.x, y: ss.y };
        for (let i = 1; i <= 24; i += 1) {
          const current = getQuadraticPoint(
            ss.x,
            ss.y,
            control.x,
            control.y,
            endX,
            endY,
            i / 24,
          );
          const distance = getPointToSegmentDistance(
            screenX,
            screenY,
            previous.x,
            previous.y,
            current.x,
            current.y,
          );
          if (distance <= 8) return edge;
          previous = current;
        }
      }
      return null;
    },
    [displayLinks, nodePositions, toScreen],
  );

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    return { x, y };
  };

  // ===== 鼠标交互：拖拽节点 + 平移画布 + 缩放 =====
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasPos(e);
    const node = getNodeAt(x, y);
    if (node) {
      setDraggedNode(node.id);
      setIsDragging(true);
      onNodeSelect(node);
      onEdgeSelect(null);
    } else {
      const edge = getEdgeAt(x, y);
      if (edge) {
        onEdgeSelect(edge);
        onNodeSelect(null);
      } else {
        // 开始平移画布
        setIsPanning(true);
        panStartRef.current = {
          x,
          y,
          offsetX: viewportRef.current.offsetX,
          offsetY: viewportRef.current.offsetY,
        };
        onNodeSelect(null);
        onEdgeSelect(null);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasPos(e);

    if (isDragging && draggedNode !== null) {
      // 拖拽节点：转换到虚拟坐标
      const v = toVirtual(x, y);
      const newPositions = new Map(nodePositions);
      const pos = newPositions.get(draggedNode);
      if (pos) {
        pos.x = v.x;
        pos.y = v.y;
        pos.vx = 0;
        pos.vy = 0;
        setNodePositions(newPositions);
      }
    } else if (isPanning) {
      // 平移画布
      const dx = x - panStartRef.current.x;
      const dy = y - panStartRef.current.y;
      setViewport({
        ...viewportRef.current,
        offsetX: panStartRef.current.offsetX + dx,
        offsetY: panStartRef.current.offsetY + dy,
      });
    } else {
      // 悬停检测
      const node = getNodeAt(x, y);
      const edge = node ? null : getEdgeAt(x, y);
      setHoveredNode(node?.id || null);
      setHoveredEdge(edge);
      const canvas = canvasRef.current;
      if (canvas) canvas.style.cursor = node || edge ? 'pointer' : 'grab';
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggedNode(null);
    setIsPanning(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setDraggedNode(null);
    setIsPanning(false);
    setHoveredNode(null);
    setHoveredEdge(null);
  };

  // 滚轮缩放：以鼠标位置为中心（使用 addEventListener 确保可 preventDefault）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);
      const vp = viewportRef.current;

      // 缩放因子
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = clamp(vp.scale * zoomFactor, 0.05, 5);

      // 以鼠标位置为中心缩放
      const newOffsetX = x - (x - vp.offsetX) * (newScale / vp.scale);
      const newOffsetY = y - (y - vp.offsetY) * (newScale / vp.scale);

      setViewport({
        scale: newScale,
        offsetX: newOffsetX,
        offsetY: newOffsetY,
      });
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);

  // 数据变化时重置用户交互标记
  useEffect(() => {
    userInteractedRef.current = false;
  }, [data.nodes, data.links]);

  // 缩放控制按钮
  const handleZoomIn = () => {
    const vp = viewportRef.current;
    const { width, height } = canvasSize;
    const centerX = width / 2;
    const centerY = height / 2;
    const newScale = clamp(vp.scale * 1.3, 0.05, 5);
    const newOffsetX = centerX - (centerX - vp.offsetX) * (newScale / vp.scale);
    const newOffsetY = centerY - (centerY - vp.offsetY) * (newScale / vp.scale);
    setViewport({ scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY });
  };

  const handleZoomOut = () => {
    const vp = viewportRef.current;
    const { width, height } = canvasSize;
    const centerX = width / 2;
    const centerY = height / 2;
    const newScale = clamp(vp.scale * 0.7, 0.05, 5);
    const newOffsetX = centerX - (centerX - vp.offsetX) * (newScale / vp.scale);
    const newOffsetY = centerY - (centerY - vp.offsetY) * (newScale / vp.scale);
    setViewport({ scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY });
  };

  const handleFitView = () => {
    autoFitViewport();
  };

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
      {/* 缩放控制 */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1">
        <button
          onClick={handleZoomIn}
          className="w-8 h-8 flex items-center justify-center rounded border bg-white/90 shadow-sm hover:bg-gray-100 text-lg font-bold text-slate-700"
          title="放大"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          className="w-8 h-8 flex items-center justify-center rounded border bg-white/90 shadow-sm hover:bg-gray-100 text-lg font-bold text-slate-700"
          title="缩小"
        >
          −
        </button>
        <button
          onClick={handleFitView}
          className="w-8 h-8 flex items-center justify-center rounded border bg-white/90 shadow-sm hover:bg-gray-100 text-xs font-bold text-slate-700"
          title="适配全图"
        >
          ⊞
        </button>
      </div>
      {/* 缩放比例指示 */}
      <div className="absolute bottom-4 left-4 z-10 rounded bg-white/80 px-2 py-1 text-xs text-slate-500 shadow-sm">
        {Math.round(viewport.scale * 100)}% · {forceParams.nodeCount} 节点 ·{' '}
        {forceParams.edgeCount} 关系
      </div>
    </div>
  );
}

// 详情面板
function DetailPanel({
  node,
  edge,
  nodeNameById,
  onClose,
}: {
  node: Node | null;
  edge: Edge | null;
  nodeNameById: Map<number, string>;
  onClose: () => void;
}) {
  const showType =
    !!node?.entity_type &&
    node.entity_type !== 'ENTITY' &&
    node.entity_type !== 'UNKNOWN' &&
    node.entity_type !== '未知';

  const showPageRank = typeof node?.pagerank === 'number';

  const edgeDescription = getEdgeDescription(edge);

  const sourceName = edge
    ? (nodeNameById.get(edge.source) ?? `节点 ${edge.source}`)
    : '';
  const targetName = edge
    ? (nodeNameById.get(edge.target) ?? `节点 ${edge.target}`)
    : '';

  if (!node && !edge) return null;

  return (
    <div className="absolute top-4 right-4 w-96 max-w-[calc(100%-2rem)] rounded-md border bg-white/95 p-4 shadow-xl backdrop-blur max-h-[calc(100%-2rem)] overflow-y-auto z-10">
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-semibold text-base text-slate-900">
          {node ? '节点详情' : '关系详情'}
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>
      </div>

      {node && (
        <div className="space-y-3 text-sm">
          <div>
            <div className="text-xs text-gray-500">实体名称</div>
            <div className="mt-1 font-medium text-slate-900">
              {node.entity_name}
            </div>
          </div>

          {showType && (
            <div>
              <div className="text-xs text-gray-500">类型</div>
              <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: getNodeColor(node.entity_type) }}
                />
                {node.entity_type}
              </div>
            </div>
          )}

          {node.aliases && node.aliases.length > 0 && (
            <div>
              <div className="text-xs text-gray-500">别名</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {node.aliases.map((alias) => (
                  <span
                    key={alias}
                    className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
                  >
                    {alias}
                  </span>
                ))}
              </div>
            </div>
          )}

          {node.description && (
            <div>
              <div className="text-xs text-gray-500">描述</div>
              <p className="mt-1 whitespace-pre-wrap leading-6 text-slate-700">
                {node.description}
              </p>
            </div>
          )}

          {showPageRank && (
            <div>
              <span className="font-medium text-gray-600">PageRank: </span>
              {node.pagerank.toFixed(4)}
            </div>
          )}

          {node.source?.length > 0 && (
            <div>
              <div className="text-xs text-gray-500">来源</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {node.source
                  .filter((item) => item && item.trim())
                  .map((item) => (
                    <span
                      key={item}
                      className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                    >
                      {item}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {edge && (
        <div className="space-y-3 text-sm">
          <div>
            <div className="text-xs text-gray-500">关系类型</div>
            <div className="mt-1 font-medium text-slate-900">
              {edge.relation}
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-500">连接</div>
            <div className="mt-1 rounded bg-slate-50 px-3 py-2 text-slate-700">
              {sourceName} → {targetName}
            </div>
          </div>

          {edgeDescription && (
            <div>
              <div className="text-xs text-gray-500">描述</div>
              <p className="mt-1 whitespace-pre-wrap leading-6 text-slate-700">
                {edgeDescription}
              </p>
            </div>
          )}

          {edge.source_detail?.length ? (
            <div>
              <div className="text-xs text-gray-500">来源</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {edge.source_detail
                  .filter((item) => item && item.trim())
                  .map((item) => (
                    <span
                      key={item}
                      className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                    >
                      {item}
                    </span>
                  ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function TypeLegend({ nodes }: { nodes: Node[] }) {
  const types = useMemo(() => {
    const counts = new Map<string, number>();
    nodes.forEach((node) => {
      const type = node.entity_type || 'Entity';
      counts.set(type, (counts.get(type) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
  }, [nodes]);

  if (!types.length) return null;

  return (
    <div className="absolute left-4 bottom-4 z-10 rounded-md border bg-white/90 px-3 py-2 text-xs text-slate-600 shadow-sm backdrop-blur">
      <div className="mb-1 font-medium text-slate-800">类型</div>
      <div className="flex max-w-[520px] flex-wrap gap-x-3 gap-y-1.5">
        {types.map(([type, count]) => (
          <div key={type} className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: getNodeColor(type) }}
            />
            <span>{type}</span>
            <span className="text-slate-400">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GraphDisplay({ kbId, kbData }: GraphDisplayProps) {
  const [graphData, setGraphData] = useState<GraphData>(EMPTY_GRAPH);
  const [originalGraphData, setOriginalGraphData] =
    useState<GraphData>(EMPTY_GRAPH);

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);

  const [searchEntity, setSearchEntity] = useState('');
  const [searchDepth, setSearchDepth] = useState('2');
  const [customDepth, setCustomDepth] = useState('4');
  const [searchFocused, setSearchFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [focusNodeId, setFocusNodeId] = useState<number | null>(null);

  const fetchGraph = useCallback(async () => {
    if (!kbId) return;

    setGraphLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/v1/graph/${kbId}/knowledge_graph`, {
        headers: {
          [Authorization]: getAuthorization(),
        },
      });
      const result = await res.json();
      if (result.code === 0 && result.data?.graph) {
        const graph = result.data.graph as GraphData;
        setGraphData(graph);
        setOriginalGraphData(graph);
      } else {
        setGraphData(EMPTY_GRAPH);
        setOriginalGraphData(EMPTY_GRAPH);
        setErrorMsg(result.message || result.msg || '图谱数据加载失败');
      }
    } catch (err) {
      console.error(err);
      setGraphData(EMPTY_GRAPH);
      setOriginalGraphData(EMPTY_GRAPH);
      setErrorMsg('网络错误，图谱数据加载失败');
    } finally {
      setGraphLoading(false);
    }
  }, [kbId]);

  /**
   * ✅ 从 Neo4j 初始化图谱
   */
  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  /**
   * id → entity_name 映射
   */
  const nodeNameById = useMemo(() => {
    return new Map<number, string>(
      graphData.nodes.map((n) => [n.id, n.entity_name]),
    );
  }, [graphData.nodes]);

  const entitySuggestions = useMemo(() => {
    const keyword = searchEntity.trim().toLowerCase();
    if (!keyword) return [];

    const nodes = originalGraphData.nodes.length
      ? originalGraphData.nodes
      : graphData.nodes;

    return nodes
      .filter((node) => {
        return node.entity_name.toLowerCase().includes(keyword);
      })
      .slice(0, 8);
  }, [graphData.nodes, originalGraphData.nodes, searchEntity]);

  /**
   * 🔍 查询子图（本地 BFS，无需网络请求，瞬间完成）
   */
  const handleSearchSubgraph = () => {
    const keyword = searchEntity.trim();
    if (!keyword || !kbId) return;

    setErrorMsg(null);

    const depthNum =
      searchDepth === 'custom'
        ? Math.max(1, Number(customDepth) || 1)
        : Math.max(1, Number(searchDepth));

    // 使用前端已有的完整图谱数据做本地 BFS
    const sourceData = originalGraphData.nodes.length
      ? originalGraphData
      : graphData;

    const nodes = sourceData.nodes;
    const edges = sourceData.edges;

    if (!nodes.length) {
      setErrorMsg('图谱数据为空，无法查询子图');
      return;
    }

    // 查找起始节点：精确匹配 → 包含匹配 → 模糊匹配
    const keywordLower = keyword.toLowerCase();
    let startIds = new Set<number>();

    // 精确匹配（名称或别名）
    for (const node of nodes) {
      const names = [node.entity_name, ...(node.aliases || [])].map((n) =>
        n.toLowerCase().trim(),
      );
      if (names.some((n) => n === keywordLower)) {
        startIds.add(node.id);
      }
    }

    // 包含匹配
    if (!startIds.size) {
      for (const node of nodes) {
        const names = [node.entity_name, ...(node.aliases || [])].map((n) =>
          n.toLowerCase().trim(),
        );
        if (
          names.some(
            (n) => n.includes(keywordLower) || keywordLower.includes(n),
          )
        ) {
          startIds.add(node.id);
        }
      }
    }

    // 模糊匹配（Levenshtein 简化版：长度差距小优先）
    if (!startIds.size) {
      let bestNode: Node | null = null;
      let bestScore = 0;
      for (const node of nodes) {
        const names = [node.entity_name, ...(node.aliases || [])].map((n) =>
          n.toLowerCase().trim(),
        );
        for (const name of names) {
          if (!name) continue;
          // 简单相似度：共同字符占比
          const maxLen = Math.max(keywordLower.length, name.length);
          const minLen = Math.min(keywordLower.length, name.length);
          if (minLen === 0) continue;
          let common = 0;
          for (let i = 0; i < minLen; i++) {
            if (keywordLower[i] === name[i]) common++;
          }
          const score = common / maxLen;
          if (score > bestScore) {
            bestScore = score;
            bestNode = node;
          }
        }
      }
      if (bestNode && bestScore >= 0.5) {
        startIds.add(bestNode.id);
      }
    }

    if (!startIds.size) {
      setErrorMsg(`未找到与「${keyword}」相关的实体`);
      return;
    }

    // 构建邻接表
    const adjacency = new Map<number, Set<number>>();
    for (const edge of edges) {
      if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set());
      if (!adjacency.has(edge.target)) adjacency.set(edge.target, new Set());
      adjacency.get(edge.source)!.add(edge.target);
      adjacency.get(edge.target)!.add(edge.source);
    }

    // BFS 遍历
    const visited = new Set<number>(startIds);
    let frontier = new Set<number>(startIds);
    for (let d = 0; d < depthNum; d++) {
      const nextFrontier = new Set<number>();
      for (const nodeId of frontier) {
        const neighbors = adjacency.get(nodeId);
        if (neighbors) {
          for (const neighborId of neighbors) {
            if (!visited.has(neighborId)) {
              nextFrontier.add(neighborId);
            }
          }
        }
      }
      for (const id of nextFrontier) visited.add(id);
      frontier = nextFrontier;
      if (!frontier.size) break;
    }

    // 提取子图节点和边
    const subNodes = nodes.filter((n) => visited.has(n.id));
    const subEdges = edges.filter(
      (e) => visited.has(e.source) && visited.has(e.target),
    );

    if (!subNodes.length) {
      setErrorMsg(`未找到与「${keyword}」相关的子图`);
      return;
    }

    // 找到搜索关键词对应的节点，作为核心居中显示
    const focusNode =
      subNodes.find((n) => n.entity_name.toLowerCase() === keywordLower) ||
      subNodes.find((n) => n.entity_name.toLowerCase().includes(keywordLower));
    setFocusNodeId(focusNode?.id ?? null);
    setGraphData({ nodes: subNodes, edges: subEdges });
    setSelectedNode(null);
    setSelectedEdge(null);
  };

  /**
   * 🔄 重置视图（回到完整真实图谱）
   */
  const handleResetView = () => {
    setSearchEntity('');
    setSelectedNode(null);
    setSelectedEdge(null);
    setFocusNodeId(null);
    setGraphData(originalGraphData);
  };

  /**
   * 🔁 刷新图谱：
   * - 如果当前处于检索子图状态（searchEntity 非空），从后端拉取最新全图谱数据后重新执行本地子图 BFS
   * - 如果当前处于全图谱状态，直接从后端刷新全图谱
   */
  const handleRefreshGraph = () => {
    const keyword = searchEntity.trim();
    if (!keyword) {
      // 全图谱模式：直接从后端刷新全图
      fetchGraph();
      return;
    }

    // 子图模式：先从后端获取最新全图谱数据，再基于新数据重新做本地 BFS
    setGraphLoading(true);
    setErrorMsg(null);

    fetch(`/v1/graph/${kbId}/knowledge_graph`, {
      headers: {
        [Authorization]: getAuthorization(),
      },
    })
      .then((res) => res.json())
      .then((result) => {
        if (result.code === 0 && result.data?.graph) {
          const latestGraph = result.data.graph as GraphData;
          setOriginalGraphData(latestGraph);

          // 使用最新数据重新执行 BFS 子图查询
          const depthNum =
            searchDepth === 'custom'
              ? Math.max(1, Number(customDepth) || 1)
              : Math.max(1, Number(searchDepth));

          const nodes = latestGraph.nodes;
          const edges = latestGraph.edges;

          if (!nodes.length) {
            setErrorMsg('图谱数据为空，无法刷新子图');
            setGraphLoading(false);
            return;
          }

          // 查找起始节点：精确匹配 → 包含匹配 → 模糊匹配
          const keywordLower = keyword.toLowerCase();
          let startIds = new Set<number>();

          for (const node of nodes) {
            const names = [node.entity_name, ...(node.aliases || [])].map((n) =>
              n.toLowerCase().trim(),
            );
            if (names.some((n) => n === keywordLower)) {
              startIds.add(node.id);
            }
          }

          if (!startIds.size) {
            for (const node of nodes) {
              const names = [node.entity_name, ...(node.aliases || [])].map(
                (n) => n.toLowerCase().trim(),
              );
              if (
                names.some(
                  (n) => n.includes(keywordLower) || keywordLower.includes(n),
                )
              ) {
                startIds.add(node.id);
              }
            }
          }

          if (!startIds.size) {
            let bestNode: Node | null = null;
            let bestScore = 0;
            for (const node of nodes) {
              const names = [node.entity_name, ...(node.aliases || [])].map(
                (n) => n.toLowerCase().trim(),
              );
              for (const name of names) {
                if (!name) continue;
                const maxLen = Math.max(keywordLower.length, name.length);
                const minLen = Math.min(keywordLower.length, name.length);
                if (minLen === 0) continue;
                let common = 0;
                for (let i = 0; i < minLen; i++) {
                  if (keywordLower[i] === name[i]) common++;
                }
                const score = common / maxLen;
                if (score > bestScore) {
                  bestScore = score;
                  bestNode = node;
                }
              }
            }
            if (bestNode && bestScore >= 0.5) {
              startIds.add(bestNode.id);
            }
          }

          if (!startIds.size) {
            setErrorMsg(`未找到与「${keyword}」相关的实体`);
            setGraphLoading(false);
            return;
          }

          // 构建邻接表
          const adjacency = new Map<number, Set<number>>();
          for (const edge of edges) {
            if (!adjacency.has(edge.source))
              adjacency.set(edge.source, new Set());
            if (!adjacency.has(edge.target))
              adjacency.set(edge.target, new Set());
            adjacency.get(edge.source)!.add(edge.target);
            adjacency.get(edge.target)!.add(edge.source);
          }

          // BFS 遍历
          const visited = new Set<number>(startIds);
          let frontier = new Set<number>(startIds);
          for (let d = 0; d < depthNum; d++) {
            const nextFrontier = new Set<number>();
            for (const nodeId of frontier) {
              const neighbors = adjacency.get(nodeId);
              if (neighbors) {
                for (const neighborId of neighbors) {
                  if (!visited.has(neighborId)) {
                    nextFrontier.add(neighborId);
                  }
                }
              }
            }
            for (const id of nextFrontier) visited.add(id);
            frontier = nextFrontier;
            if (!frontier.size) break;
          }

          const subNodes = nodes.filter((n) => visited.has(n.id));
          const subEdges = edges.filter(
            (e) => visited.has(e.source) && visited.has(e.target),
          );

          if (!subNodes.length) {
            setErrorMsg(`刷新后未找到与「${keyword}」相关的子图`);
            setGraphLoading(false);
            return;
          }

          // 找到焦点节点
          const focusNode =
            subNodes.find(
              (n) => n.entity_name.toLowerCase() === keywordLower,
            ) ||
            subNodes.find((n) =>
              n.entity_name.toLowerCase().includes(keywordLower),
            );
          setFocusNodeId(focusNode?.id ?? null);
          setGraphData({ nodes: subNodes, edges: subEdges });
          setSelectedNode(null);
          setSelectedEdge(null);
        } else {
          setErrorMsg(result.message || result.msg || '图谱数据刷新失败');
        }
        setGraphLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setErrorMsg('网络错误，图谱数据刷新失败');
        setGraphLoading(false);
      });
  };

  const hasGraph = useMemo(
    () => graphData.nodes.length > 0 || graphData.edges.length > 0,
    [graphData],
  );

  if (graphLoading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        加载图谱数据中...
      </div>
    );
  }

  return (
    <div className="h-full relative">
      {/* 控制面板 - 悬浮在图谱上方 */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center gap-2 rounded-lg bg-white/90 px-3 py-2 shadow-md backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">知识图谱</h2>
          <div className="text-sm text-gray-500">
            {graphData.nodes.length} 节点 · {graphData.edges.length} 关系
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center ml-auto">
          <div className="relative w-56">
            <Input
              value={searchEntity}
              onChange={(e) => setSearchEntity(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchSubgraph()}
              placeholder="输入实体名称搜索子图"
              className="w-full h-8 text-sm"
            />
            {searchFocused && entitySuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-md border bg-white py-1 shadow-lg">
                {entitySuggestions.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setSearchEntity(node.entity_name);
                      setSearchFocused(false);
                    }}
                  >
                    <div className="truncate text-sm font-medium text-slate-900">
                      {node.entity_name}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                      <span>{node.entity_type || 'ENTITY'}</span>
                      <span>ID: {node.id}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <Select value={searchDepth} onValueChange={setSearchDepth}>
            <SelectTrigger className="w-20 h-8 text-sm">
              <SelectValue placeholder="层数" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 层</SelectItem>
              <SelectItem value="2">2 层</SelectItem>
              <SelectItem value="3">3 层</SelectItem>
              <SelectItem value="custom">自定义</SelectItem>
            </SelectContent>
          </Select>

          {searchDepth === 'custom' && (
            <Input
              type="number"
              min={1}
              max={20}
              value={customDepth}
              onChange={(e) => setCustomDepth(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchSubgraph()}
              placeholder="层数"
              className="w-16 h-8 text-sm"
            />
          )}

          <Button
            size="sm"
            onClick={handleSearchSubgraph}
            disabled={isSearching || !searchEntity.trim()}
          >
            {isSearching ? '查询中...' : '查询子图'}
          </Button>

          <Button size="sm" variant="outline" onClick={handleResetView}>
            重置视图
          </Button>

          <Button size="sm" variant="outline" onClick={handleRefreshGraph}>
            刷新图谱
          </Button>

          <ManualGraphEditor
            graphId={kbId}
            variant="button"
            onGraphChanged={handleRefreshGraph}
          />
        </div>
      </div>

      {errorMsg && (
        <div className="absolute top-16 left-3 z-20 rounded-md bg-red-50 px-3 py-1.5 text-sm text-red-600 shadow-sm">
          {errorMsg}
        </div>
      )}

      {/* 图谱展示 - 占满整个区域 */}
      <div className="h-full w-full relative">
        {hasGraph ? (
          <>
            <div className="w-full h-full">
              <InteractiveForceGraph
                data={{
                  nodes: graphData.nodes,
                  links: graphData.edges,
                }}
                selectedNode={selectedNode}
                selectedEdge={selectedEdge}
                onNodeSelect={setSelectedNode}
                onEdgeSelect={setSelectedEdge}
                focusNodeId={focusNodeId}
              />
            </div>

            <DetailPanel
              node={selectedNode}
              edge={selectedEdge}
              nodeNameById={nodeNameById}
              onClose={() => {
                setSelectedNode(null);
                setSelectedEdge(null);
              }}
            />
            <TypeLegend nodes={graphData.nodes} />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 italic">
            暂无图谱数据
          </div>
        )}
      </div>
    </div>
  );
}
