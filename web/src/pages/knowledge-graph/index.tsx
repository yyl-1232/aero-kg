import ListFilterBar from '@/components/list-filter-bar';
import { Button } from '@/components/ui/button';
import { useInfiniteFetchKnowledgeGraphList } from '@/hooks/graph-hooks';
import { IKnowledgeGraph } from '@/hooks/use-knowledge-graph-request';
import { Empty, Skeleton, Spin } from 'antd';
import { GitGraph, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import InfiniteScroll from 'react-infinite-scroll-component';
import { Helmet } from 'umi';
import { useSaveKnowledgeGraph } from './hooks';
import KnowledgeGraphCard from './knowledge-graph-card';
import KnowledgeGraphCreatingModal from './knowledge-graph-creating-modal';

export default function KnowledgeGraphPage() {
  const { t } = useTranslation();

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

  const nextList = useMemo<IKnowledgeGraph[]>(() => {
    return (
      data?.pages?.flatMap((page) =>
        Array.isArray(page.graphs) ? (page.graphs as IKnowledgeGraph[]) : [],
      ) ?? []
    );
  }, [data?.pages]);

  return (
    <section className="py-4 flex-1 flex flex-col">
      <Helmet>
        <title>AeroKG</title>
      </Helmet>

      <ListFilterBar
        title={t('header.knowledgeGraph')}
        searchString={searchString}
        onSearchChange={handleInputChange}
        showFilter={false}
        className="px-8"
        icon={<GitGraph className="size-6" />}
      >
        <Button onClick={showModal}>
          <Plus className="size-2.5" />
          {t('knowledgeGraphList.createKnowledgeGraph')}
        </Button>
      </ListFilterBar>

      <Spin spinning={loading} className="flex-1">
        <div
          id="scrollableDiv"
          className="flex-1 overflow-auto px-8 max-h-[78vh]"
        >
          <InfiniteScroll
            dataLength={nextList.length}
            next={fetchNextPage}
            hasMore={hasNextPage}
            loader={<Skeleton avatar paragraph={{ rows: 1 }} active />}
            scrollableTarget="scrollableDiv"
            scrollThreshold="200px"
          >
            {nextList.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 pb-4">
                {nextList.map((item) => (
                  <KnowledgeGraphCard item={item} key={item.id} />
                ))}
              </div>
            ) : (
              <Empty className="knowledge-graph-empty" />
            )}
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
