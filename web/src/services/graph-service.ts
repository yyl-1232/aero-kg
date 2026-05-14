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

export const createGraphEntity = (
  graphId: string,
  params: Record<string, any>,
) => {
  return request.post(`/v1/graph/${graphId}/knowledge_graph/entities`, {
    data: params,
  });
};

export const updateGraphEntity = (
  graphId: string,
  entityId: string | number,
  params: Record<string, any>,
) => {
  return request.put(
    `/v1/graph/${graphId}/knowledge_graph/entities/${entityId}`,
    {
      data: params,
    },
  );
};

export const deleteGraphEntity = (
  graphId: string,
  entityId: string | number,
) => {
  return request.delete(
    `/v1/graph/${graphId}/knowledge_graph/entities/${entityId}`,
  );
};

export const createGraphRelation = (
  graphId: string,
  params: Record<string, any>,
) => {
  return request.post(`/v1/graph/${graphId}/knowledge_graph/relations`, {
    data: params,
  });
};

export const updateGraphRelation = (
  graphId: string,
  relationId: string | number,
  params: Record<string, any>,
) => {
  return request.put(
    `/v1/graph/${graphId}/knowledge_graph/relations/${relationId}`,
    {
      data: params,
    },
  );
};

export const deleteGraphRelation = (
  graphId: string,
  relationId: string | number,
) => {
  return request.delete(
    `/v1/graph/${graphId}/knowledge_graph/relations/${relationId}`,
  );
};

export const exportGraphSnapshot = (graphId: string) => {
  return request.get(`/v1/graph/${graphId}/knowledge_graph/export`, {
    responseType: 'blob',
  });
};

export default graphService;
