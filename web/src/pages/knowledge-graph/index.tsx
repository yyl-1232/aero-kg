import ListFilterBar from '@/components/list-filter-bar';
import { useInfiniteFetchKnowledgeGraphList } from '@/hooks/graph-hooks';
import { useFetchUserInfo } from '@/hooks/user-setting-hooks';
import { Button, Divider, Empty, Flex, Skeleton, Spin } from 'antd';
import { Plus } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import InfiniteScroll from 'react-infinite-scroll-component';
import { Helmet } from 'umi';
import { useSaveKnowledgeGraph } from './hooks';
import KnowledgeGraphCard from './knowledge-graph-card';
import KnowledgeGraphCreatingModal from './knowledge-graph-creating-modal';

export default function KnowledgeGraphPage() {
  const { data: userInfo } = useFetchUserInfo();
  const { t } = useTranslation('translation', {
    keyPrefix: 'knowledgeGraphList',
  });

  const {
    visible,
    hideModal,
    showModal,
    onCreateOk,
    loading: creatingLoading,
  } = useSaveKnowledgeGraph();

  const {
    fetchNextPage,
    data,
    hasNextPage,
    searchString,
    handleInputChange,
    loading,
  } = useInfiniteFetchKnowledgeGraphList();

  const nextList = useMemo(() => {
    const list =
      data?.pages?.flatMap((x) => (Array.isArray(x.graphs) ? x.graphs : [])) ??
      [];
    return list;
  }, [data?.pages]);

  const total = useMemo(() => {
    return data?.pages.at(-1).total ?? 0;
  }, [data?.pages]);

  const leftPanel = <div className="text-2xl font-semibold">知识图谱</div>;

  return (
    <section className="flex h-full flex-col w-full">
      <Helmet>
        <title>{t('header.knowledgeGraph')}</title>
      </Helmet>

      <div className="p-8">
        <ListFilterBar
          icon="data"
          leftPanel={leftPanel}
          searchString={searchString}
          onSearchChange={handleInputChange}
          showFilter={false}
        >
          <Button
            type="primary"
            onClick={showModal}
            className="h-8 px-5 text-sm flex items-center"
          >
            <Plus className="mr-1 size-3.5 flex-shrink-0" />
            <span className="whitespace-nowrap">
              {t('createKnowledgeGraph')}
            </span>
          </Button>
        </ListFilterBar>
      </div>

      <Spin spinning={loading}>
        <div
          id="scrollableDiv"
          style={{
            height: 'calc(100vh - 250px)',
            overflow: 'auto',
            padding: '0 16px',
          }}
        >
          <InfiniteScroll
            dataLength={nextList?.length ?? 0}
            next={fetchNextPage}
            hasMore={hasNextPage}
            loader={<Skeleton avatar paragraph={{ rows: 1 }} active />}
            endMessage={
              !!total && <Divider plain>{t('noMoreData')} 🤐</Divider>
            }
            scrollableTarget="scrollableDiv"
            scrollThreshold="200px"
          >
            <Flex
              gap={'large'}
              wrap="wrap"
              className="knowledge-graph-card-container"
            >
              {nextList?.length > 0 ? (
                nextList.map((item: any, index: number) => {
                  return (
                    <KnowledgeGraphCard
                      item={item}
                      key={`${item?.name}-${index}`}
                    />
                  );
                })
              ) : (
                <Empty className="knowledge-graph-empty" />
              )}
            </Flex>
          </InfiniteScroll>
        </div>
      </Spin>

      <KnowledgeGraphCreatingModal
        loading={creatingLoading}
        visible={visible}
        hideModal={hideModal}
        onOk={onCreateOk}
      />
    </section>
  );
}
