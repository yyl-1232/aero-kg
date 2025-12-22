import {
  CalendarOutlined,
  NodeIndexOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';
import { Avatar, Badge, Card, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'umi';

import OperateDropdown from '@/components/operate-dropdown';
import { useDeleteKnowledgeGraph } from '@/hooks/graph-hooks';
import { useFetchUserInfo } from '@/hooks/user-setting-hooks';
import { IKnowledgeGraph } from '@/interfaces/database/knowledge';
import { formatDate } from '@/utils/date';
import classNames from 'classnames';
import styles from './index.less';

interface IProps {
  item: IKnowledgeGraph;
}

const KnowledgeGraphCard = ({ item }: IProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { deleteKnowledgeGraph } = useDeleteKnowledgeGraph();
  const { data: userInfo } = useFetchUserInfo();

  const handleCardClick = () => {
    navigate(`/knowledge-graph/${item.id}`);
  };

  const removeKnowledgeGraph = async () => {
    return deleteKnowledgeGraph(item.id);
  };

  return (
    <Badge.Ribbon
      text={item?.nickname}
      color={userInfo?.nickname === item?.nickname ? '#1677ff' : 'pink'}
      className={classNames(styles.ribbon, {
        [styles.hideRibbon]: item.permission !== 'team',
      })}
    >
      <Card className={styles.card} onClick={handleCardClick}>
        <div className={styles.container}>
          <div className={styles.content}>
            <Avatar size={34} icon={<NodeIndexOutlined />} />
            <OperateDropdown
              deleteItem={removeKnowledgeGraph}
            ></OperateDropdown>
          </div>
          <div className={styles.titleWrapper}>
            <span className={styles.title}>{item.name}</span>
            <p className={styles.description}>
              {item.description || t('noDescription')}
            </p>
          </div>
          <div className={styles.footer}>
            <div className={styles.footerTop}>
              <div className={styles.bottomLeft}>
                <NodeIndexOutlined className={styles.leftIcon} />
                <span className={styles.rightText}>
                  <Space>
                    {item?.node_num ?? 0}
                    {t('节点')}
                  </Space>
                </span>
              </div>
              <div className={styles.bottomRight}>
                <ShareAltOutlined className={styles.leftIcon} />
                <span className={styles.rightText}>
                  <Space>
                    {item?.edge_num ?? 0}
                    {t('关系')}
                  </Space>
                </span>
              </div>
            </div>
            <div className={styles.bottom}>
              <div className={styles.bottomLeft}>
                <CalendarOutlined className={styles.leftIcon} />
                <span className={styles.rightText}>
                  {formatDate(item.create_time)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </Badge.Ribbon>
  );
};

export default KnowledgeGraphCard;
