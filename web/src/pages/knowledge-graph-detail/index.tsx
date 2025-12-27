import { RAGFlowAvatar } from '@/components/ragflow-avatar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
  useFetchKnowledgeBaseConfiguration,
  useKnowledgeBaseId,
} from '@/hooks/knowledge-hooks';
import { cn } from '@/lib/utils';
import { formatPureDate } from '@/utils/date';
import { useQueryClient } from '@tanstack/react-query';
import { FileSearch2, GitGraph, Upload } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'umi';
import { FileUpload } from './components/file-upload';
type TabType = 'graph-display' | 'retrieval-test' | 'file-upload';

const KnowledgeGraphDetail = () => {
  const { id } = useParams();
  const datasetId = useKnowledgeBaseId();
  const { data: kbData, loading: kbLoading } =
    useFetchKnowledgeBaseConfiguration();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('graph-display');
  console.log('kbData:', kbData);
  const handleBackToList = () => {
    navigate('/knowledge-graph');
  };
  const refreshKnowledgeGraph = () => {
    let queryClient = useQueryClient();
    queryClient.invalidateQueries({
      queryKey: ['fetchKnowledgeGraph', datasetId],
    });
  };

  const tabs = [
    {
      key: 'graph-display' as TabType,
      label: '知识图谱展示',
      icon: GitGraph,
    },
    {
      key: 'retrieval-test' as TabType,
      label: '检索测试',
      icon: FileSearch2,
    },
    {
      key: 'file-upload' as TabType,
      label: '实体-关系文件上传',
      icon: Upload,
    },
  ];

  // 显示加载状态
  if (kbLoading) {
    return <div className="p-6">加载中...</div>;
  }

  return (
    <div className="flex flex-col w-full h-screen bg-background text-foreground">
      {/* 顶部面包屑 */}
      <div className="p-6 pb-0">
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
      </div>

      {/* 主要内容区域 */}
      <div className="flex flex-1 bg-background">
        {/* 左侧边栏 */}
        <aside className="relative p-5 space-y-8 w-80">
          {/* 知识图谱基本信息 */}
          <div className="flex gap-2.5 max-w-[200px] items-center">
            <RAGFlowAvatar
              avatar={kbData?.avatar}
              name={kbData?.name}
              className="size-16"
            />
            <div className="text-text-secondary text-xs space-y-1 overflow-hidden">
              <h3 className="text-lg font-semibold line-clamp-1 text-text-primary">
                {kbData?.name}
              </h3>
              <div className="flex justify-between">
                <span>{kbData?.node_num ?? 0} 节点</span>
                <span>{kbData?.edge_num ?? 0} 关系</span>
              </div>
              <div>创建于 {formatPureDate(kbData?.create_time)}</div>
            </div>
          </div>

          {/* 功能按钮 */}
          <div className="w-full flex flex-col gap-3">
            {tabs.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <Button
                  key={tab.key}
                  variant={active ? 'secondary' : 'ghost'}
                  className={cn(
                    'w-full justify-start gap-2.5 px-3 relative h-10 text-text-sub-title-invert',
                    {
                      'bg-bg-card': active,
                      'text-text-primary': active,
                    },
                  )}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <tab.icon className="size-4" />
                  <span>{tab.label}</span>
                </Button>
              );
            })}
          </div>
        </aside>

        {/* 右侧内容区域 */}
        <main className="flex-1 p-6">
          {activeTab === 'graph-display' && (
            <div className="h-full">
              <h2 className="text-xl font-semibold mb-4">知识图谱展示</h2>
              <div className="bg-white rounded-lg border p-4 h-[calc(100%-3rem)]">
                {/* 这里放置知识图谱可视化组件 */}
                <div className="flex items-center justify-center h-full text-gray-500">
                  知识图谱可视化区域 (待实现)
                </div>
              </div>
            </div>
          )}

          {activeTab === 'retrieval-test' && (
            <div className="h-full">
              <h2 className="text-xl font-semibold mb-4">检索测试</h2>
              <div className="bg-white rounded-lg border p-4 h-[calc(100%-3rem)]">
                {/* 这里放置检索测试组件 */}
                <div className="flex items-center justify-center h-full text-gray-500">
                  检索测试区域 (待实现)
                </div>
              </div>
            </div>
          )}

          {activeTab === 'file-upload' && (
            <div className="h-full">
              <h2 className="text-xl font-semibold mb-4">实体-关系文件上传</h2>
              <div className="bg-white rounded-lg border p-4 h-[calc(100%-3rem)]">
                <FileUpload
                  onUploadSuccess={() => {
                    // 刷新文件列表或显示成功消息
                    console.log('Files uploaded successfully');
                  }}
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default KnowledgeGraphDetail;
