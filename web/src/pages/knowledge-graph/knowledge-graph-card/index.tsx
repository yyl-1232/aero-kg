import { MoreOutlined } from '@ant-design/icons';
import { Card, Dropdown } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'umi';

import { useDeleteKnowledgeGraph } from '@/hooks/graph-hooks';
import { IKnowledgeGraph } from '@/interfaces/database/knowledge';

interface IProps {
  item: IKnowledgeGraph;
}

const KnowledgeGraphCard = ({ item }: IProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { deleteKnowledgeGraph } = useDeleteKnowledgeGraph();

  const handleCardClick = () => {
    navigate(`/knowledge-graph/${item.id}`);
  };

  const handleDelete = (e: any) => {
    e.domEvent?.stopPropagation(); // 使用 domEvent 属性
    e.domEvent?.preventDefault();
    deleteKnowledgeGraph(item.id);
  };

  const items = [
    {
      key: 'delete',
      label: t('common.delete'),
      onClick: handleDelete,
    },
  ];

  return (
    <Card
      hoverable
      className="knowledge-graph-card"
      onClick={handleCardClick}
      extra={
        <Dropdown menu={{ items }} trigger={['click']}>
          <MoreOutlined onClick={(e) => e.stopPropagation()} />
        </Dropdown>
      }
    >
      <Card.Meta
        title={item.name}
        description={item.description || t('noDescription')}
      />
    </Card>
  );
};

export default KnowledgeGraphCard;
