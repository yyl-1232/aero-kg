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
import { useFetchKnowledgeGraph } from '@/hooks/knowledge-hooks';
import { getAuthorization } from '@/utils/authorization-util';
import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
}

interface Edge {
  source: number;
  target: number;
  relation: string;
  description: string;
  weight: number;
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

// ✅ 新增：绘制曲线箭头的函数
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

  // 计算控制点（贝塞尔曲线）
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  // 垂直于连线方向的偏移
  const offsetX = -dy * curvature;
  const offsetY = dx * curvature;

  const controlX = midX + offsetX;
  const controlY = midY + offsetY;

  // 绘制曲线
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(controlX, controlY, x2, y2);
  ctx.stroke();

  // 在终点绘制箭头
  const angle = Math.atan2(y2 - controlY, x2 - controlX);

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

function InteractiveForceGraph({
  data,
  selectedNode,
  selectedEdge,
  onNodeSelect,
  onEdgeSelect,
}: {
  data: { nodes: Node[]; links: Edge[] };
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  onNodeSelect: (node: Node | null) => void;
  onEdgeSelect: (edge: Edge | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 600 });

  const [nodePositions, setNodePositions] = useState<Map<number, NodePosition>>(
    new Map(),
  );
  const [draggedNode, setDraggedNode] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<Edge | null>(null);
  const animationRef = useRef<number>();

  const NODE_BASE_RADIUS = 8;
  const NODE_HOVER_RADIUS = 11;
  const NODE_SELECTED_RADIUS = 14;

  const PADDING = 40;

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

  // 初始化节点位置（自适应：节点少更分散、节点多更紧凑）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.nodes.length === 0) return;

    const { width, height } = canvasSize;
    const cx = width / 2;
    const cy = height / 2;

    const n = Math.max(1, data.nodes.length);
    const area = width * height;
    const baseSpacing = Math.sqrt(area / n);

    const MAX_R = Math.min(width, height) / 2 - PADDING;
    const initR = clamp(baseSpacing * 2.6, MAX_R * 0.35, MAX_R * 0.85);

    const positions = new Map<number, NodePosition>();
    data.nodes.forEach((node, i) => {
      const angle = (i / data.nodes.length) * Math.PI * 2;
      const x = cx + Math.cos(angle) * initR;
      const y = cy + Math.sin(angle) * initR;
      positions.set(node.id, {
        x: Math.max(PADDING, Math.min(width - PADDING, x)),
        y: Math.max(PADDING, Math.min(height - PADDING, y)),
        vx: 0,
        vy: 0,
      });
    });

    setNodePositions(positions);
  }, [data.nodes, canvasSize.width, canvasSize.height]);

  // ✅ 优化的力导向布局：让有连接的节点更靠近
  useEffect(() => {
    if (nodePositions.size === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { width, height } = canvasSize;

    const n = Math.max(1, data.nodes.length);
    const area = width * height;
    const baseSpacing = Math.sqrt(area / n);

    // ✅ 关键参数调整：让连接的节点距离更近
    const LINK_DISTANCE = clamp(baseSpacing * 1.2, 60, 180);
    const repulsionForce = clamp(
      LINK_DISTANCE * LINK_DISTANCE * 0.08,
      80,
      1600,
    );
    const springK = clamp(0.02 + (100 / LINK_DISTANCE) * 0.01, 0.02, 0.05);
    const centerForce = clamp(0.015 + (n / 1500) * 0.025, 0.015, 0.05);
    const damping = 0.88;

    const cx = width / 2;
    const cy = height / 2;
    const MAX_R = Math.min(width, height) / 2 - PADDING;
    const BOUND_FORCE = 0.03;

    const minDist = clamp(LINK_DISTANCE * 0.7, NODE_BASE_RADIUS * 2 + 15, 150);
    const pushApart = clamp(0.4 + (100 / LINK_DISTANCE) * 0.18, 0.4, 0.7);

    const simulate = () => {
      const newPositions = new Map(nodePositions);
      let maxMove = 0;

      // 1) 斥力 + 中心力
      data.nodes.forEach((n1) => {
        const p1 = newPositions.get(n1.id);
        if (!p1) return;

        data.nodes.forEach((n2) => {
          if (n1.id === n2.id) return;
          const p2 = newPositions.get(n2.id);
          if (!p2) return;

          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const safeDist = Math.max(8, dist);

          const force = repulsionForce / (safeDist * safeDist);
          p1.vx += (dx / safeDist) * force;
          p1.vy += (dy / safeDist) * force;
        });

        p1.vx += (cx - p1.x) * centerForce;
        p1.vy += (cy - p1.y) * centerForce;
      });

      // ✅ 2) 边的弹簧力：让有连接的节点相互靠近的关键！
      data.links.forEach((link) => {
        const p1 = newPositions.get(link.source);
        const p2 = newPositions.get(link.target);
        if (!p1 || !p2) return;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        const delta = dist - LINK_DISTANCE;
        const force = delta * springK;

        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        p1.vx += fx;
        p1.vy += fy;
        p2.vx -= fx;
        p2.vy -= fy;
      });

      // 3) 碰撞分离：防止缩成一团
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
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;

          if (dist < minDist) {
            const overlap = (minDist - dist) / dist;
            const ox = dx * overlap * pushApart;
            const oy = dy * overlap * pushApart;

            pa.x -= ox * 0.5;
            pa.y -= oy * 0.5;
            pb.x += ox * 0.5;
            pb.y += oy * 0.5;

            pa.vx *= 0.9;
            pa.vy *= 0.9;
            pb.vx *= 0.9;
            pb.vy *= 0.9;
          }
        }
      }

      // 4) 更新位置 + 软圆边界 + 兜底 clamp
      data.nodes.forEach((node) => {
        const pos = newPositions.get(node.id);
        if (!pos || draggedNode === node.id) return;

        pos.vx *= damping;
        pos.vy *= damping;
        pos.x += pos.vx;
        pos.y += pos.vy;

        const dx = pos.x - cx;
        const dy = pos.y - cy;
        const distFromCenter = Math.sqrt(dx * dx + dy * dy) || 1;

        if (distFromCenter > MAX_R) {
          const exceed = distFromCenter - MAX_R;
          const fx = (-dx / distFromCenter) * exceed * BOUND_FORCE;
          const fy = (-dy / distFromCenter) * exceed * BOUND_FORCE;
          pos.x += fx;
          pos.y += fy;
          pos.vx *= 0.65;
          pos.vy *= 0.65;
        }

        pos.x = Math.max(PADDING, Math.min(width - PADDING, pos.x));
        pos.y = Math.max(PADDING, Math.min(height - PADDING, pos.y));

        maxMove = Math.max(maxMove, Math.abs(pos.vx) + Math.abs(pos.vy));
      });

      setNodePositions(newPositions);
      if (maxMove > 0.08)
        animationRef.current = requestAnimationFrame(simulate);
    };

    animationRef.current = requestAnimationFrame(simulate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [
    data.nodes,
    data.links.length,
    nodePositions,
    draggedNode,
    canvasSize.width,
    canvasSize.height,
  ]);

  // ✅ 绘制：使用曲线箭头替代直线
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvasSize;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.font = '12px sans-serif';

    // ✅ 边（曲线箭头）
    data.links.forEach((link) => {
      const s = nodePositions.get(link.source);
      const t = nodePositions.get(link.target);
      if (!s || !t) return;

      const isHovered = hoveredEdge === link;
      const isSelected = selectedEdge === link;

      ctx.strokeStyle = isSelected
        ? '#3b82f6'
        : isHovered
          ? '#60a5fa'
          : '#cbd5e1';
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = isSelected ? 3 : isHovered ? 2 : 1.5;

      // 计算目标节点半径，让箭头停在节点边缘
      const targetRadius =
        selectedNode?.id === link.target
          ? NODE_SELECTED_RADIUS
          : hoveredNode === link.target
            ? NODE_HOVER_RADIUS
            : NODE_BASE_RADIUS;

      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ratio = (dist - targetRadius - 2) / dist;

      const endX = s.x + dx * ratio;
      const endY = s.y + dy * ratio;

      // 绘制曲线箭头
      drawCurvedArrow(ctx, s.x, s.y, endX, endY, 0.15);
    });

    // 节点
    data.nodes.forEach((node) => {
      const pos = nodePositions.get(node.id);
      if (!pos) return;

      const isHovered = hoveredNode === node.id;
      const isSelected = selectedNode?.id === node.id;
      const radius = isSelected
        ? NODE_SELECTED_RADIUS
        : isHovered
          ? NODE_HOVER_RADIUS
          : NODE_BASE_RADIUS;

      const colors: Record<string, string> = {
        person: '#ef4444',
        organization: '#3b82f6',
        location: '#10b981',
        concept: '#f59e0b',
        event: '#8b5cf6',
        entity: '#3b82f6', // 添加ENTITY类型的颜色
      };

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = colors[node.entity_type?.toLowerCase()] || '#3b82f6';
      ctx.fill();
      ctx.strokeStyle = isSelected
        ? '#1e40af'
        : isHovered
          ? '#2563eb'
          : 'white';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.stroke();

      // 标签
      const label = node.entity_name;
      const textWidth = ctx.measureText(label).width;
      const labelX = pos.x + radius + 6;
      const labelY = pos.y;

      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(labelX - 4, labelY - 9, textWidth + 8, 18);

      ctx.fillStyle = '#1e293b';
      ctx.font =
        isSelected || isHovered ? 'bold 13px sans-serif' : '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, labelX, labelY);
    });

    ctx.restore();
  }, [
    data,
    nodePositions,
    hoveredNode,
    hoveredEdge,
    selectedNode,
    selectedEdge,
    canvasSize,
  ]);

  // 命中测试
  const getNodeAt = (x: number, y: number) => {
    for (const node of data.nodes) {
      const pos = nodePositions.get(node.id);
      if (!pos) continue;
      const dx = x - pos.x;
      const dy = y - pos.y;
      const r = NODE_SELECTED_RADIUS;
      if (Math.sqrt(dx * dx + dy * dy) <= r) return node;
    }
    return null;
  };

  const getEdgeAt = (x: number, y: number) => {
    for (const edge of data.links) {
      const s = nodePositions.get(edge.source);
      const t = nodePositions.get(edge.target);
      if (!s || !t) continue;

      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) continue;

      const dot = ((x - s.x) * dx + (y - s.y) * dy) / (len * len);
      if (dot < 0 || dot > 1) continue;

      const px = s.x + dot * dx;
      const py = s.y + dot * dy;

      if (Math.sqrt((x - px) ** 2 + (y - py) ** 2) <= 8) return edge;
    }
    return null;
  };

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    return { x, y };
  };

  // 鼠标交互
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
        onNodeSelect(null);
        onEdgeSelect(null);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasPos(e);

    if (isDragging && draggedNode !== null) {
      const newPositions = new Map(nodePositions);
      const pos = newPositions.get(draggedNode);
      if (pos) {
        pos.x = Math.max(PADDING, Math.min(canvasSize.width - PADDING, x));
        pos.y = Math.max(PADDING, Math.min(canvasSize.height - PADDING, y));
        pos.vx = 0;
        pos.vy = 0;
        setNodePositions(newPositions);
      }
    } else {
      const node = getNodeAt(x, y);
      setHoveredNode(node?.id || null);
      if (!node) setHoveredEdge(getEdgeAt(x, y));
      const canvas = canvasRef.current;
      if (canvas)
        canvas.style.cursor = node || hoveredEdge ? 'pointer' : 'default';
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggedNode(null);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setDraggedNode(null);
    setHoveredNode(null);
    setHoveredEdge(null);
  };

  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-default"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
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

  const showPageRank =
    typeof node?.pagerank === 'number' && Math.abs(node.pagerank - 1) > 1e-9;

  const showEdgeDescription =
    !!edge?.description &&
    !!edge?.relation &&
    edge.description.trim() !== '' &&
    edge.description.trim() !== edge.relation.trim();

  const showEdgeWeight =
    typeof edge?.weight === 'number' && Math.abs(edge.weight - 2) > 1e-9;

  const sourceName = edge
    ? (nodeNameById.get(edge.source) ?? `节点 ${edge.source}`)
    : '';
  const targetName = edge
    ? (nodeNameById.get(edge.target) ?? `节点 ${edge.target}`)
    : '';

  if (!node && !edge) return null;

  return (
    <div className="absolute top-4 right-4 w-80 bg-white rounded-lg shadow-lg border p-4 max-h-96 overflow-y-auto z-10">
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-semibold text-lg">
          {node ? '节点详情' : '关系详情'}
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>
      </div>

      {node && (
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium text-gray-600">实体名称：</span>
            {node.entity_name}
          </div>

          {showType && (
            <div>
              <span className="font-medium text-gray-600">类型：</span>
              {node.entity_type}
            </div>
          )}

          {node.description && (
            <div>
              <span className="font-medium text-gray-600">描述：</span>
              {node.description}
            </div>
          )}

          {showPageRank && (
            <div>
              <span className="font-medium text-gray-600">PageRank：</span>
              {node.pagerank.toFixed(4)}
            </div>
          )}

          {node.source?.length > 0 && (
            <div>
              <span className="font-medium text-gray-600">来源：</span>
              {node.source.join(', ')}
            </div>
          )}
        </div>
      )}

      {edge && (
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium text-gray-600">关系类型：</span>
            {edge.relation}
          </div>

          {showEdgeDescription && (
            <div>
              <span className="font-medium text-gray-600">描述：</span>
              {edge.description}
            </div>
          )}

          {showEdgeWeight && (
            <div>
              <span className="font-medium text-gray-600">权重：</span>
              {edge.weight.toFixed(2)}
            </div>
          )}

          <div>
            <span className="font-medium text-gray-600">连接：</span>
            {sourceName} → {targetName}
          </div>
        </div>
      )}
    </div>
  );
}

export default function GraphDisplay({ kbId, kbData }: GraphDisplayProps) {
  const queryClient = useQueryClient();

  const [graphData, setGraphData] = useState<GraphData>(EMPTY_GRAPH);
  const [originalGraphData, setOriginalGraphData] =
    useState<GraphData>(EMPTY_GRAPH);

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);

  const [searchEntity, setSearchEntity] = useState('');
  const [searchDepth, setSearchDepth] = useState('2');
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: knowledgeGraph, loading: graphLoading } =
    useFetchKnowledgeGraph();

  /**
   * ✅ 使用真实接口数据初始化图谱
   */
  useEffect(() => {
    const graph = knowledgeGraph?.graph;
    if (graph && Array.isArray(graph.nodes) && Array.isArray(graph.edges)) {
      setGraphData(graph);
      // 只在首次加载真实图谱时保存一份原始数据
      setOriginalGraphData((prev) => (prev.nodes.length === 0 ? graph : prev));
    }
    queryClient.invalidateQueries({ queryKey: ['fetchKnowledgeGraph'] });
  }, [knowledgeGraph]);

  /**
   * id → entity_name 映射
   */
  const nodeNameById = useMemo(() => {
    return new Map<number, string>(
      graphData.nodes.map((n) => [n.id, n.entity_name]),
    );
  }, [graphData.nodes]);

  /**
   * 🔍 查询子图
   */
  const handleSearchSubgraph = async () => {
    const keyword = searchEntity.trim();
    if (!keyword || !kbId) return;

    setErrorMsg(null);
    setIsSearching(true);

    try {
      const depthNum = Math.min(3, Math.max(1, Number(searchDepth)));

      const res = await fetch(`/v1/kb/${kbId}/knowledge_graph/subgraph`, {
        method: 'POST',
        headers: {
          [Authorization]: getAuthorization(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entity_name: keyword,
          depth: depthNum,
        }),
      });

      const result = await res.json();

      if (result.code === 0 && result.data?.subgraph) {
        const sub = result.data.subgraph as GraphData;

        if (sub.nodes?.length) {
          setGraphData(sub);
          setSelectedNode(null);
          setSelectedEdge(null);
        } else {
          setErrorMsg(`未找到与「${keyword}」相关的子图`);
        }
      } else {
        setErrorMsg(result.msg || '子图查询失败，请稍后重试');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('网络错误，子图查询失败');
    } finally {
      setIsSearching(false);
    }
  };

  /**
   * 🔄 重置视图（回到完整真实图谱）
   */
  const handleResetView = () => {
    setSearchEntity('');
    setSelectedNode(null);
    setSelectedEdge(null);
    setGraphData(originalGraphData);
    queryClient.invalidateQueries({
      queryKey: ['fetchKnowledgeGraph'],
    });
  };

  /**
   * 🔁 刷新真实图谱
   */
  const handleRefreshGraph = () =>
    queryClient.invalidateQueries({
      queryKey: ['fetchKnowledgeGraph'],
    });

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
    <div className="h-full flex flex-col">
      {/* 控制面板 */}
      <div className="flex flex-wrap justify-between items-center mb-4 gap-2 bg-gray-50 p-3 rounded-lg shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="text-xl font-semibold">知识图谱</h2>
          <div className="text-sm text-gray-500">
            {graphData.nodes.length} 节点 · {graphData.edges.length} 关系
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Input
            value={searchEntity}
            onChange={(e) => setSearchEntity(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearchSubgraph()}
            placeholder="输入实体名称，例如：高超声速飞行器"
            className="w-64"
          />

          <Select value={searchDepth} onValueChange={setSearchDepth}>
            <SelectTrigger className="w-24">
              <SelectValue placeholder="层数" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 层</SelectItem>
              <SelectItem value="2">2 层</SelectItem>
              <SelectItem value="3">3 层</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={handleSearchSubgraph}
            disabled={isSearching || !searchEntity.trim()}
          >
            {isSearching ? '查询中...' : '查询子图'}
          </Button>

          <Button variant="outline" onClick={handleResetView}>
            重置视图
          </Button>

          <Button variant="outline" onClick={handleRefreshGraph}>
            刷新图谱
          </Button>
        </div>
      </div>

      {errorMsg && <div className="mb-2 text-sm text-red-500">{errorMsg}</div>}

      {/* 图谱展示 */}
      <div className="bg-white rounded-lg border p-4 flex-1 min-h-0 relative">
        {hasGraph ? (
          <>
            <div className="w-full h-[560px]">
              <InteractiveForceGraph
                data={{
                  nodes: graphData.nodes,
                  links: graphData.edges,
                }}
                selectedNode={selectedNode}
                selectedEdge={selectedEdge}
                onNodeSelect={setSelectedNode}
                onEdgeSelect={setSelectedEdge}
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
