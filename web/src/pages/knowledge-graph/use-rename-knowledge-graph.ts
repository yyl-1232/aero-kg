import { useSetModalState } from '@/hooks/common-hooks';
import { useRenameKnowledgeGraph } from '@/hooks/graph-hooks';
import { IKnowledgeGraph } from '@/hooks/use-knowledge-graph-request';
import { useCallback, useState } from 'react';

export const useRenameKnowledgeGraphModal = () => {
  const [graph, setGraph] = useState<IKnowledgeGraph>({} as IKnowledgeGraph);
  const {
    visible: graphRenameVisible,
    hideModal: hideGraphRenameModal,
    showModal: showGraphRenameModal,
  } = useSetModalState();
  const { renameKnowledgeGraph, loading } = useRenameKnowledgeGraph();

  const onGraphRenameOk = useCallback(
    async (name: string) => {
      const ret = await renameKnowledgeGraph({
        graph_id: graph.id,
        name,
        description: graph.description || '',
      });

      if (ret.code === 0) {
        hideGraphRenameModal();
      }
    },
    [graph.description, graph.id, hideGraphRenameModal, renameKnowledgeGraph],
  );

  const handleShowGraphRenameModal = useCallback(
    (record: IKnowledgeGraph) => {
      setGraph(record);
      showGraphRenameModal();
    },
    [showGraphRenameModal],
  );

  return {
    graphRenameLoading: loading,
    initialGraphName: graph?.name,
    onGraphRenameOk,
    graphRenameVisible,
    hideGraphRenameModal,
    showGraphRenameModal: handleShowGraphRenameModal,
  };
};
