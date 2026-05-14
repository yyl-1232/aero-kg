import api from '@/utils/api';
import registerServer from '@/utils/register-server';
import request from '@/utils/request';

const { graph_create, graph_list, graph_update } = api;

const methods = {
  createGraph: {
    url: graph_create,
    method: 'post',
  },
  listGraph: {
    url: graph_list,
    method: 'post',
  },
  updateGraph: {
    url: graph_update,
    method: 'post',
  },
};

const graphService = registerServer<keyof typeof methods>(methods, request);

export const deleteGraph = (graphId: string) => {
  const url = `/v1/graph/${graphId}/delete`;
  return request.delete(url);
};

export const getGraphDetail = (graphId: string) => {
  return request.get(api.graph_detail(graphId));
};

export default graphService;
