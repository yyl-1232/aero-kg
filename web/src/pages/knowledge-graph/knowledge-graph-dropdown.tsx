import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDeleteKnowledgeGraph } from '@/hooks/graph-hooks';
import { IKnowledgeGraph } from '@/hooks/use-knowledge-graph-request';
import { Trash2 } from 'lucide-react';
import { PropsWithChildren, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export function KnowledgeGraphDropdown({
  children,
  graph,
}: PropsWithChildren<{
  graph: IKnowledgeGraph;
}>) {
  const { t } = useTranslation();
  const { deleteKnowledgeGraph } = useDeleteKnowledgeGraph();

  const handleDelete = useCallback(() => {
    deleteKnowledgeGraph(graph.id);
  }, [deleteKnowledgeGraph, graph.id]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent>
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
