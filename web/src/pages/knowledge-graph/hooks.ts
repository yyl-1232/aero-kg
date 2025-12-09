import { useSetModalState } from '@/hooks/common-hooks';
import { useCreateKnowledgeGraph } from '@/hooks/graph-hooks';
import { useNavigatePage } from '@/hooks/logic-hooks/navigate-hooks';
import { message } from 'antd';
import { useCallback } from 'react';

export const useSaveKnowledgeGraph = () => {
  const { visible, hideModal, showModal } = useSetModalState();
  const { loading, createKnowledgeGraph } = useCreateKnowledgeGraph();
  const { navigateToKnowledgeGraph } = useNavigatePage();

  const onCreateOk = useCallback(
    async (name: string, description: string) => {
      const ret = await createKnowledgeGraph({
        name,
        description,
      });

      if (ret?.code === 0) {
        hideModal();
        // navigateToKnowledgeGraph(ret.data.graph_id)();
        message.success('知识图谱创建成功');
      }
    },
    [createKnowledgeGraph, hideModal, navigateToKnowledgeGraph],
  );

  return {
    loading,
    onCreateOk,
    visible,
    hideModal,
    showModal,
  };
};
