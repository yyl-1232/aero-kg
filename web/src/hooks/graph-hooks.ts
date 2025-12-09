import i18n from '@/locales/config';
import graphService, { deleteGraph } from '@/services/graph-service';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useDebounce } from 'ahooks';
import { message } from 'antd';
import { useHandleSearchChange } from './logic-hooks';

export const useInfiniteFetchKnowledgeGraphList = () => {
  const { searchString, handleInputChange } = useHandleSearchChange();
  const debouncedSearchString = useDebounce(searchString, { wait: 500 });

  const PageSize = 30;

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ['infiniteFetchKnowledgeGraphList', debouncedSearchString],
    queryFn: async ({ pageParam }) => {
      const { data } = await graphService.listGraph({
        page: pageParam,
        page_size: PageSize,
        keywords: debouncedSearchString,
      });
      const list = data?.data ?? [];
      return list;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages, lastPageParam) => {
      if (lastPageParam * PageSize <= lastPage.total) {
        return lastPageParam + 1;
      }
      return undefined;
    },
  });

  return {
    data,
    loading: isFetching,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status,
    handleInputChange,
    searchString,
  };
};

export const useCreateKnowledgeGraph = () => {
  const queryClient = useQueryClient();
  const {
    data,
    isPending: loading,
    mutateAsync,
  } = useMutation({
    mutationKey: ['createKnowledgeGraph'],
    mutationFn: async (params: { name: string; description: string }) => {
      const { data = {} } = await graphService.createGraph(params);
      if (data.code === 0) {
        message.success(i18n.t(`message.created`));
        // 关键：刷新列表查询
        queryClient.invalidateQueries({
          queryKey: ['infiniteFetchKnowledgeGraphList'],
        });
      }
      return data;
    },
  });

  return { data, loading, createKnowledgeGraph: mutateAsync };
};
export const useDeleteKnowledgeGraph = () => {
  const queryClient = useQueryClient();

  const {
    data,
    isPending: loading,
    mutateAsync,
  } = useMutation({
    mutationKey: ['deleteKnowledgeGraph'],
    mutationFn: async (graphId: string) => {
      if (!graphId) {
        throw new Error('Graph ID is required');
      }

      // 使用独立的 deleteGraph 函数
      const { data } = await deleteGraph(graphId);
      if (data.code === 0) {
        message.success(i18n.t('message.deleted'));
        queryClient.invalidateQueries({
          queryKey: ['infiniteFetchKnowledgeGraphList'],
        });
      } else {
        message.error(data.message || '删除失败');
      }
      return data?.data ?? [];
    },
  });

  return { data, loading, deleteKnowledgeGraph: mutateAsync };
};

export const useFetchKnowledgeGraphDetail = (graphId: string) => {
  const { data, isFetching: loading } = useQuery({
    queryKey: ['fetchKnowledgeGraphDetail', graphId],
    enabled: !!graphId,
    queryFn: async () => {
      const { data } = await graphService.getGraphDetail(graphId);
      return data?.data;
    },
  });

  return { data, loading };
};
