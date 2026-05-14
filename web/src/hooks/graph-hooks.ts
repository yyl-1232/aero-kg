import i18n from '@/locales/config';
import graphService, {
  deleteGraph,
  getGraphDetail,
} from '@/services/graph-service';
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
    mutationFn: async (params: { name: string; description?: string }) => {
      const { data = {} } = await graphService.createGraph(params);
      if (data.code === 0) {
        message.success(i18n.t('message.created'));
        queryClient.invalidateQueries({
          queryKey: ['infiniteFetchKnowledgeGraphList'],
        });
        queryClient.invalidateQueries({
          queryKey: ['fetchKnowledgeGraphList'],
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

      const { data } = await deleteGraph(graphId);
      if (data.code === 0) {
        message.success(i18n.t('message.deleted'));
        queryClient.invalidateQueries({
          queryKey: ['infiniteFetchKnowledgeGraphList'],
        });
        queryClient.invalidateQueries({
          queryKey: ['fetchKnowledgeGraphList'],
        });
      } else {
        message.error(data.message || 'Delete failed');
      }
      return data?.data ?? [];
    },
  });

  return { data, loading, deleteKnowledgeGraph: mutateAsync };
};

export const useRenameKnowledgeGraph = () => {
  const queryClient = useQueryClient();

  const {
    data,
    isPending: loading,
    mutateAsync,
  } = useMutation({
    mutationKey: ['renameKnowledgeGraph'],
    mutationFn: async (params: {
      graph_id: string;
      name: string;
      description?: string;
      permission?: string;
    }) => {
      const { data = {} } = await graphService.updateGraph(params);
      if (data.code === 0) {
        message.success(i18n.t('message.renamed'));
        queryClient.invalidateQueries({
          queryKey: ['infiniteFetchKnowledgeGraphList'],
        });
        queryClient.invalidateQueries({
          queryKey: ['fetchKnowledgeGraphList'],
        });
        queryClient.invalidateQueries({
          queryKey: ['fetchKnowledgeGraphDetail', params.graph_id],
        });
      } else {
        message.error(data.message || 'Rename failed');
      }
      return data;
    },
  });

  return { data, loading, renameKnowledgeGraph: mutateAsync };
};

export const useFetchKnowledgeGraphDetail = (graphId: string) => {
  const { data, isFetching: loading } = useQuery({
    queryKey: ['fetchKnowledgeGraphDetail', graphId],
    enabled: !!graphId,
    queryFn: async () => {
      const { data } = await getGraphDetail(graphId);
      return data?.data;
    },
  });

  return { data, loading };
};
