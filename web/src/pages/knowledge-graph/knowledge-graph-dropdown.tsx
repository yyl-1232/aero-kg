import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDeleteKnowledgeGraph } from '@/hooks/graph-hooks';
import { IKnowledgeGraph } from '@/hooks/use-knowledge-graph-request';
import { PenLine, Trash2 } from 'lucide-react';
import { MouseEventHandler, PropsWithChildren, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRenameKnowledgeGraphModal } from './use-rename-knowledge-graph';

type KnowledgeGraphDropdownProps = PropsWithChildren &
  Pick<
    ReturnType<typeof useRenameKnowledgeGraphModal>,
    'showGraphRenameModal'
  > & {
    graph: IKnowledgeGraph;
  };

export function KnowledgeGraphDropdown({
  children,
  graph,
  showGraphRenameModal,
}: KnowledgeGraphDropdownProps) {
  const { t } = useTranslation();
  const { deleteKnowledgeGraph } = useDeleteKnowledgeGraph();

  const handleShowGraphRenameModal: MouseEventHandler<HTMLDivElement> =
    useCallback(
      (e) => {
        e.stopPropagation();
        showGraphRenameModal(graph);
      },
      [graph, showGraphRenameModal],
    );

  const handleDelete: MouseEventHandler<HTMLDivElement> = useCallback(() => {
    deleteKnowledgeGraph(graph.id);
  }, [deleteKnowledgeGraph, graph.id]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={handleShowGraphRenameModal}>
          {t('common.rename')} <PenLine />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <ConfirmDeleteDialog onOk={handleDelete}>
          <DropdownMenuItem
            className="text-state-error"
            onSelect={(e) => {
              e.preventDefault();
            }}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            {t('common.delete')} <Trash2 />
          </DropdownMenuItem>
        </ConfirmDeleteDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
