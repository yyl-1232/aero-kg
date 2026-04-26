import api from '@/utils/api';
import registerServer from '@/utils/register-server';
import request from '@/utils/request';

const { graph_create, graph_list, graph_update, graph_detail } = api;

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
  getGraphDetail: {
    url: graph_detail,
    method: 'get',
  },
};

const graphService = registerServer<keyof typeof methods>(methods, request);

export const deleteGraph = (graphId: string) => {
  const url = `/v1/graph/${graphId}/delete`;
  return request.delete(url);
};

export default graphService;
