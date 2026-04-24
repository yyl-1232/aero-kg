import { MoreButton } from '@/components/more-button';
import { RAGFlowAvatar } from '@/components/ragflow-avatar';
import { SharedBadge } from '@/components/shared-badge';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigatePage } from '@/hooks/logic-hooks/navigate-hooks';
import { IKnowledgeGraph } from '@/hooks/use-knowledge-graph-request';
import { formatDate } from '@/utils/date';
import { NodeIndexOutlined, ShareAltOutlined } from '@ant-design/icons';
import { MouseEventHandler } from 'react';
import { KnowledgeGraphDropdown } from '../knowledge-graph-dropdown';

interface IProps {
  item: IKnowledgeGraph;
}

const KnowledgeGraphCard = ({ item }: IProps) => {
  const { navigateToKnowledgeGraph } = useNavigatePage();

  const stopPropagation: MouseEventHandler<HTMLButtonElement> = (e) => {
    e.stopPropagation();
  };

  return (
    <Card
      className="bg-bg-card border-colors-outline-neutral-standard"
      onClick={navigateToKnowledgeGraph(item.id)}
    >
      <CardContent className="p-4 flex gap-2 items-start group h-full">
        <div className="flex justify-between mb-4">
          <RAGFlowAvatar className="w-[32px] h-[32px]" name={item.name} />
        </div>

        <div className="flex flex-col justify-between gap-3 flex-1 h-full w-[calc(100%-50px)]">
          <section className="flex justify-between gap-2">
            <div className="text-[20px] font-bold leading-5 truncate">
              {item.name}
            </div>
            <KnowledgeGraphDropdown graph={item}>
              <MoreButton onClick={stopPropagation} />
            </KnowledgeGraphDropdown>
          </section>

          <section className="flex items-center gap-4 text-xs text-text-secondary min-h-6">
            <span className="inline-flex items-center gap-1">
              <NodeIndexOutlined />
              {item.node_num ?? 0}
            </span>
            <span className="inline-flex items-center gap-1">
              <ShareAltOutlined />
              {item.edge_num ?? 0}
            </span>
          </section>

          <section className="flex justify-between items-center gap-2">
            <span className="text-sm opacity-80">
              {formatDate(item.update_time || item.create_time)}
            </span>
            {item.permission === 'team' && item.nickname ? (
              <SharedBadge>{item.nickname}</SharedBadge>
            ) : null}
          </section>
        </div>
      </CardContent>
    </Card>
  );
};

export default KnowledgeGraphCard;
