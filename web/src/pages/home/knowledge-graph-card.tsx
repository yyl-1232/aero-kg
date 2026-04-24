import { MoreButton } from '@/components/more-button';
import OperateDropdown from '@/components/operate-dropdown';
import { RAGFlowAvatar } from '@/components/ragflow-avatar';
import { SharedBadge } from '@/components/shared-badge';
import { Card, CardContent } from '@/components/ui/card';
import { useDeleteKnowledgeGraph } from '@/hooks/graph-hooks';
import { useNavigatePage } from '@/hooks/logic-hooks/navigate-hooks';
import { IKnowledgeGraph } from '@/hooks/use-knowledge-graph-request';
import { formatDate } from '@/utils/date';
import { NodeIndexOutlined, ShareAltOutlined } from '@ant-design/icons';
import { ChevronRight } from 'lucide-react';
import { MouseEventHandler } from 'react';

type KnowledgeGraphSummary = IKnowledgeGraph & {
  nickname?: string;
};

interface HomeKnowledgeGraphCardProps {
  graph: KnowledgeGraphSummary;
}

export function HomeKnowledgeGraphCard({ graph }: HomeKnowledgeGraphCardProps) {
  const { navigateToKnowledgeGraph } = useNavigatePage();
  const { deleteKnowledgeGraph } = useDeleteKnowledgeGraph();

  const handleDelete = () => deleteKnowledgeGraph(graph.id);

  const stopPropagation: MouseEventHandler<HTMLButtonElement> = (e) => {
    e.stopPropagation();
  };

  return (
    <Card
      className="bg-bg-card border-colors-outline-neutral-standard"
      onClick={navigateToKnowledgeGraph(graph.id)}
    >
      <CardContent className="p-4 flex gap-2 items-start group h-full">
        <div className="flex justify-between mb-4">
          <RAGFlowAvatar className="w-[32px] h-[32px]" name={graph.name} />
        </div>

        <div className="flex flex-col justify-between gap-2 flex-1 h-full w-[calc(100%-50px)]">
          <section className="flex justify-between gap-2">
            <div className="text-[20px] font-bold leading-5 truncate">
              {graph.name}
            </div>
            <OperateDropdown deleteItem={handleDelete}>
              <MoreButton onClick={stopPropagation} />
            </OperateDropdown>
          </section>

          <section className="flex flex-col gap-2 mt-1">
            <div className="flex items-center gap-4 text-xs text-text-secondary">
              <span className="inline-flex items-center gap-1">
                <NodeIndexOutlined />
                {graph.node_num ?? 0}
              </span>
              <span className="inline-flex items-center gap-1">
                <ShareAltOutlined />
                {graph.edge_num ?? 0}
              </span>
            </div>

            <div className="flex justify-between items-center gap-2">
              <span className="text-sm opacity-80">
                {formatDate(graph.update_time || graph.create_time)}
              </span>
              {graph.nickname ? (
                <SharedBadge>{graph.nickname}</SharedBadge>
              ) : null}
            </div>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}

export function SeeAllKnowledgeGraphCard() {
  const { navigateToKnowledgeGraphList } = useNavigatePage();

  return (
    <Card
      className="w-40 flex-none h-full"
      onClick={navigateToKnowledgeGraphList}
    >
      <CardContent className="p-2.5 pt-1 w-full h-full flex items-center justify-center gap-1.5 text-text-secondary">
        See All <ChevronRight className="size-4" />
      </CardContent>
    </Card>
  );
}
