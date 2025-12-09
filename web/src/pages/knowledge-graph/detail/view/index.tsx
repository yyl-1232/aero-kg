// web/src/pages/knowledge-graph/detail/view/index.tsx
import { useFetchKnowledgeGraphDetail } from '@/hooks/graph-hooks';
import { useEffect, useRef } from 'react';

export default function KnowledgeGraphView() {
  const { id } = useParams();
  const { data } = useFetchKnowledgeGraphDetail(id);
  const containerRef = useRef(null);

  useEffect(() => {
    if (data && containerRef.current) {
      // 初始化图谱可视化
      // 可以使用 D3.js、ECharts 或其他图谱库
    }
  }, [data]);

  return (
    <div className="p-6">
      <h2>{t('knowledgeGraphView')}</h2>
      <div
        ref={containerRef}
        className="w-full h-96 border rounded"
        style={{ minHeight: '500px' }}
      >
        {/* 图谱可视化内容 */}
      </div>
    </div>
  );
}
