import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  useFetchKnowledgeBaseConfiguration,
  useFetchKnowledgeGraph,
} from '@/hooks/knowledge-hooks';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'umi';

const KnowledgeGraphDetail = () => {
  const { id } = useParams();
  const { data: graphData, loading: graphLoading } = useFetchKnowledgeGraph();
  const { data: kbData, loading: kbLoading } =
    useFetchKnowledgeBaseConfiguration();
  const { t } = useTranslation();
  const navigate = useNavigate();

  // 详细的调试信息
  console.log('=== Knowledge Graph Detail Debug ===');
  console.log('URL ID:', id);
  console.log('Graph Data:', graphData);
  console.log('Graph Loading:', graphLoading);
  console.log('KB Data:', kbData);
  console.log('KB Loading:', kbLoading);

  // 检查数据结构
  if (kbData) {
    console.log('KB Data structure:', Object.keys(kbData));
    console.log('KB Name:', kbData.name);
    console.log('KB ID:', kbData.id);
  }

  if (graphData) {
    console.log('Graph Data structure:', Object.keys(graphData));
    console.log('Graph Name:', graphData.name);
  }

  const handleBackToList = () => {
    navigate('/knowledge-graph');
  };

  // 显示加载状态
  if (kbLoading) {
    console.log('Still loading KB data...');
    return <div className="p-6">加载中...</div>;
  }

  console.log('Rendering with data - KB Name:', graphData?.name);

  return (
    <div className="p-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={handleBackToList}>
              {t('header.knowledgeGraph')}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>
              {kbData?.name || `图谱详情 (ID: ${id})`}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mt-6">
        <h1 className="text-2xl font-bold mb-4">
          {kbData?.name || `知识图谱详情 (ID: ${id})`}
        </h1>
        <p className="text-gray-600">图谱ID: {id}</p>
        {!kbData?.name && (
          <p className="text-red-500 mt-2">
            警告：无法获取知识库名称，请检查权限或网络连接
          </p>
        )}

        {/* 调试信息显示 */}
        <div className="mt-4 p-4 bg-gray-100 rounded text-sm">
          <h3 className="font-bold mb-2">调试信息:</h3>
          <p>KB Data: {JSON.stringify(kbData, null, 2)}</p>
          <p>Graph Data: {JSON.stringify(graphData, null, 2)}</p>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeGraphDetail;
