import { useSetModalState } from '@/hooks/common-hooks';
import { useCreateKnowledgeGraph } from '@/hooks/graph-hooks';
import { message } from 'antd';
import { useCallback } from 'react';

export const useSaveKnowledgeGraph = () => {
  const { visible, hideModal, showModal } = useSetModalState();
  const { loading, createKnowledgeGraph } = useCreateKnowledgeGraph();

  const onCreateOk = useCallback(
    async (name: string) => {
      const ret = await createKnowledgeGraph({
        name,
        description: '',
      });

      if (ret?.code === 0) {
        hideModal();
        message.success('Knowledge graph created');
      }
    },
    [createKnowledgeGraph, hideModal],
  );

  return {
    loading,
    onCreateOk,
    visible,
    hideModal,
    showModal,
  };
};
