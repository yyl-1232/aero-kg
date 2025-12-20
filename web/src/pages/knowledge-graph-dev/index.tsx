import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog';
import { Button } from '@/components/ui/button';
import { useFetchKnowledgeGraph } from '@/hooks/use-knowledge-request';
import { ArrowLeft, Trash2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'umi';
import ForceGraph from '../dataset/knowledge-graph/force-graph';
import { useDeleteKnowledgeGraph } from '../dataset/knowledge-graph/use-delete-graph';

const KnowledgeGraphDev: React.FC = () => {
  const { id } = useParams();
  const { data } = useFetchKnowledgeGraph();
  const { t } = useTranslation();
  const { handleDeleteKnowledgeGraph } = useDeleteKnowledgeGraph();
  const navigate = useNavigate();

  return (
    <section className={'w-full h-screen relative p-6'}>
      {/* 返回按钮 */}
      <Button
        variant="outline"
        size={'sm'}
        className="absolute left-6 top-6 z-50"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft /> {t('common.back')}
      </Button>

      {/* 删除按钮 */}
      <ConfirmDeleteDialog onOk={handleDeleteKnowledgeGraph}>
        <Button
          variant="outline"
          size={'sm'}
          className="absolute right-6 top-6 z-50"
        >
          <Trash2 /> {t('common.delete')}
        </Button>
      </ConfirmDeleteDialog>

      {/* 知识图谱主体 */}
      <ForceGraph data={data?.graph} show></ForceGraph>
    </section>
  );
};

export default KnowledgeGraphDev;
