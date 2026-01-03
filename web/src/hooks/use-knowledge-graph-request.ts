import { getGraphList } from '@/services/knowledge-service';
import { useQuery } from '@tanstack/react-query';

export interface IKnowledgeGraph {
  id: string;
  name: string;
  description: string;
  node_num: number;
  edge_num: number;
  create_time: number;
  update_time: number;
  permission: string;
  status: string;
}

export const useFetchKnowledgeGraphList = () => {
  const { data, isFetching: loading } = useQuery<{
    graphs: IKnowledgeGraph[];
    total: number;
  }>({
    queryKey: ['fetchKnowledgeGraphList'],
    queryFn: async () => {
      const { data } = await getGraphList();
      return data?.data ?? { graphs: [], total: 0 };
    },
  });

  return {
    loading,
    knowledgeGraphs: data?.graphs || [],
    total: data?.total || 0,
  };
};
