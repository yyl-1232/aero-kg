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
import { useFetchKnowledgeBaseConfiguration } from '@/hooks/knowledge-hooks';
import { cn } from '@/lib/utils';
import { getAuthorization } from '@/utils/authorization-util';
import { formatPureDate } from '@/utils/date';
import { FileSearch2, GitGraph, Settings2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'umi';
import GraphDisplay from './components/graph-display';
import { GraphManagement } from './components/graph-management';
import RetrievalTest from './components/retrieval-test';

type TabType = 'graph-display' | 'retrieval-test' | 'graph-management';

const KnowledgeGraphDetail = () => {
  const { id } = useParams();
  const { data: kbData, loading: kbLoading } =
    useFetchKnowledgeBaseConfiguration();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('graph-display');
  const [hasExistingFile, setHasExistingFile] = useState(false);

  useEffect(() => {
    const checkExistingFile = async () => {
      if (!id) return;
      try {
        const response = await fetch(`/v1/graph/${id}/knowledge_graph`, {
          headers: { Authorization: getAuthorization() },
        });
        const result = await response.json();
        const graphData = result.data?.graph || result.graph;
        setHasExistingFile(
          Boolean(
            graphData &&
            ((graphData.nodes && graphData.nodes.length > 0) ||
              (graphData.edges && graphData.edges.length > 0)),
          ),
        );
      } catch {
        setHasExistingFile(false);
      }
    };

    checkExistingFile();
  }, [id]);

  const handleBackToList = () => {
    navigate('/knowledge-graph');
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
      key: 'graph-management' as TabType,
      label: '图谱管理',
      icon: Settings2,
    },
  ];

  if (kbLoading) {
    return <div className="p-6">加载中...</div>;
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground">
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

      <div className="flex flex-1 bg-background">
        <aside className="relative w-80 space-y-8 p-5">
          <div className="flex max-w-[220px] items-center gap-2.5">
            <RAGFlowAvatar
              avatar={kbData?.avatar}
              name={kbData?.name}
              className="size-16"
            />
            <div className="space-y-1 overflow-hidden text-xs text-text-secondary">
              <h3 className="line-clamp-1 text-lg font-semibold text-text-primary">
                {kbData?.name}
              </h3>
              <div className="flex gap-4">
                <span>{kbData?.node_num ?? 0} 节点</span>
                <span>{kbData?.edge_num ?? 0} 关系</span>
              </div>
              <div>创建于 {formatPureDate(kbData?.create_time)}</div>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3">
            {tabs.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <Button
                  key={tab.key}
                  variant={active ? 'secondary' : 'ghost'}
                  className={cn(
                    'relative h-10 w-full justify-start gap-2.5 px-3 text-text-sub-title-invert',
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

        <main className="flex-1 p-6 min-h-0 overflow-hidden">
          {activeTab === 'graph-display' && (
            <GraphDisplay kbId={id || ''} kbData={kbData} />
          )}

          {activeTab === 'retrieval-test' && (
            <div className="h-full">
              <h2 className="mb-4 text-xl font-semibold">检索测试</h2>
              <RetrievalTest knowledgeGraphId={id || ''} />
            </div>
          )}

          {activeTab === 'graph-management' && (
            <div className="h-full">
              <GraphManagement
                graphId={id || ''}
                graphData={kbData}
                hasExistingFile={hasExistingFile}
                onUploaded={() => setHasExistingFile(true)}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default KnowledgeGraphDetail;
