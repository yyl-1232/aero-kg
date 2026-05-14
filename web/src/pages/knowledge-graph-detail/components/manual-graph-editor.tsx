import { Button } from '@/components/ui/button';
import { Authorization } from '@/constants/authorization';
import {
  createGraphEntity,
  createGraphRelation,
  deleteGraphEntity,
  deleteGraphRelation,
  exportGraphSnapshot,
  updateGraphEntity,
  updateGraphRelation,
} from '@/services/graph-service';
import { getAuthorization } from '@/utils/authorization-util';
import { downloadFileFromBlob } from '@/utils/file-util';
import { useQueryClient } from '@tanstack/react-query';
import {
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CirclePlus,
  Download,
  Edit3,
  Network,
  PencilLine,
  Search,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type ManualGraphEditorProps = {
  graphId: string;
  variant?: 'section' | 'button';
  onGraphChanged?: () => void | Promise<void>;
};

type GraphEntity = {
  id: number | string;
  entity_name: string;
  entity_type?: string;
  description?: string;
  aliases?: string[];
  source?: string[];
};

type GraphRelation = {
  id?: string;
  source: number | string;
  target: number | string;
  relation: string;
  description?: string;
  source_detail?: string[];
};

type EditorMode = 'create' | 'edit';
type EditorTarget = 'entity' | 'relation';

const EMPTY_GRAPH = {
  nodes: [] as GraphEntity[],
  edges: [] as GraphRelation[],
};

type RelationFormValues = {
  source?: string;
  target?: string;
  relation?: string;
  description?: string;
  source_detail?: string;
};

function normalizeListValue(value?: string) {
  return value
    ?.split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinListValue(value?: string[]) {
  return value?.join(', ') || '';
}

export function ManualGraphEditor({
  graphId,
  variant = 'section',
  onGraphChanged,
}: ManualGraphEditorProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [activeTarget, setActiveTarget] = useState<EditorTarget>('entity');
  const [mode, setMode] = useState<EditorMode>('create');
  const [editingEntity, setEditingEntity] = useState<GraphEntity | null>(null);
  const [editingRelation, setEditingRelation] = useState<GraphRelation | null>(
    null,
  );
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [graph, setGraph] = useState(EMPTY_GRAPH);
  const [entitySearch, setEntitySearch] = useState('');
  const [relationSearch, setRelationSearch] = useState('');
  const [relationDraft, setRelationDraft] = useState<RelationFormValues>({});
  const [entityForm] = Form.useForm();
  const [relationForm] = Form.useForm();

  const nodeNameById = useMemo(() => {
    return new Map(
      graph.nodes.map((node) => [String(node.id), node.entity_name]),
    );
  }, [graph.nodes]);

  const entityOptions = useMemo(
    () =>
      graph.nodes.map((node) => ({
        value: String(node.id),
        label: `${node.entity_name} ${node.entity_type || ''} ${node.id}`,
        displayName: node.entity_name,
        entityType: node.entity_type || 'ENTITY',
        nodeId: String(node.id),
      })),
    [graph.nodes],
  );

  const filteredEntities = useMemo(() => {
    const keyword = entitySearch.trim().toLowerCase();
    if (!keyword) return graph.nodes;

    return graph.nodes.filter((node) => {
      const searchableText = [
        node.id,
        node.entity_name,
        node.entity_type,
        node.description,
        ...(node.aliases || []),
        ...(node.source || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(keyword);
    });
  }, [entitySearch, graph.nodes]);

  const filteredRelations = useMemo(() => {
    const keyword = relationSearch.trim().toLowerCase();
    if (!keyword) return graph.edges;

    return graph.edges.filter((edge) => {
      const sourceName = nodeNameById.get(String(edge.source));
      const targetName = nodeNameById.get(String(edge.target));
      const searchableText = [
        edge.id,
        edge.source,
        sourceName,
        edge.target,
        targetName,
        edge.relation,
        edge.description,
        ...(edge.source_detail || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(keyword);
    });
  }, [graph.edges, nodeNameById, relationSearch]);

  const fetchGraphPreview = async () => {
    if (!graphId) return;

    setLoadingGraph(true);
    try {
      const res = await fetch(`/v1/graph/${graphId}/knowledge_graph`, {
        headers: {
          [Authorization]: getAuthorization(),
        },
      });
      const result = await res.json();
      const nextGraph = result.data?.graph || result.graph || EMPTY_GRAPH;
      setGraph({
        nodes: Array.isArray(nextGraph.nodes) ? nextGraph.nodes : [],
        edges: Array.isArray(nextGraph.edges) ? nextGraph.edges : [],
      });
    } catch {
      setGraph(EMPTY_GRAPH);
    } finally {
      setLoadingGraph(false);
    }
  };

  const applyServerGraph = async (nextGraph?: {
    nodes?: GraphEntity[];
    edges?: GraphRelation[];
  }) => {
    if (nextGraph) {
      setGraph({
        nodes: Array.isArray(nextGraph.nodes) ? nextGraph.nodes : [],
        edges: Array.isArray(nextGraph.edges) ? nextGraph.edges : [],
      });
    }
    await queryClient.invalidateQueries({
      queryKey: ['fetchKnowledgeGraphDetail', graphId],
    });
    await queryClient.invalidateQueries({
      queryKey: ['fetchKnowledgeDetail'],
    });
    await queryClient.invalidateQueries({
      queryKey: ['fetchKnowledgeGraphList'],
    });
    await queryClient.invalidateQueries({
      queryKey: ['infiniteFetchKnowledgeGraphList'],
    });
    await onGraphChanged?.();
  };

  useEffect(() => {
    if (open) {
      fetchGraphPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, graphId]);

  const openEntityEditor = (
    nextMode: EditorMode,
    entity?: GraphEntity | null,
  ) => {
    setActiveTarget('entity');
    setMode(nextMode);
    setEditingEntity(entity || null);
    entityForm.setFieldsValue(
      entity
        ? {
            ...entity,
            aliases: joinListValue(entity.aliases),
            source: joinListValue(entity.source),
          }
        : {
            entity_type: 'ENTITY',
            aliases: '',
            source: '',
          },
    );
    setOpen(true);
  };

  const openRelationEditor = (
    nextMode: EditorMode,
    relation?: GraphRelation | null,
  ) => {
    setActiveTarget('relation');
    setMode(nextMode);
    setEditingRelation(relation || null);
    const nextValues = relation
      ? {
          ...relation,
          source: String(relation.source),
          target: String(relation.target),
          source_detail: joinListValue(relation.source_detail),
        }
      : {
          source: undefined,
          target: undefined,
          relation: undefined,
          description: undefined,
          source_detail: '',
        };
    relationForm.setFieldsValue(nextValues);
    setRelationDraft(nextValues);
    setOpen(true);
  };

  const handleSubmitEntity = async () => {
    const values = {
      ...entityForm.getFieldsValue(true),
      ...(await entityForm.validateFields()),
    };
    const payload = {
      ...values,
      aliases: normalizeListValue(values.aliases),
      source: normalizeListValue(values.source),
    };

    setSaving(true);
    try {
      const { data } =
        mode === 'edit' && editingEntity
          ? await updateGraphEntity(graphId, editingEntity.id, payload)
          : await createGraphEntity(graphId, payload);

      if (data?.code === 0) {
        const entity = data.data?.entity as GraphEntity | undefined;
        await applyServerGraph(data.data?.graph);
        if (entity) {
          setEditingEntity(entity);
          setMode('edit');
          entityForm.setFieldsValue({
            ...entity,
            aliases: joinListValue(entity.aliases),
            source: joinListValue(entity.source),
          });
        }
        message.success(mode === 'create' ? '节点已创建' : '节点已保存');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitRelation = async () => {
    console.log('[ManualGraphEditor] relation submit raw fields:', {
      allFields: relationForm.getFieldsValue(true),
      touchedFields: relationForm.getFieldsValue(),
      activeTarget,
      mode,
      editingRelation,
    });

    await relationForm.validateFields();
    const values = {
      ...relationDraft,
      ...Object.fromEntries(
        Object.entries(relationForm.getFieldsValue(true)).filter(
          ([, value]) => value !== undefined,
        ),
      ),
    };
    const payload = {
      ...values,
      relation: values.relation?.trim(),
      source_detail: normalizeListValue(values.source_detail),
    };

    console.log('[ManualGraphEditor] relation submit payload:', payload);

    if (!payload.source || !payload.target || !payload.relation) {
      message.error('请选择起点、终点并填写关系类型');
      return;
    }

    setSaving(true);
    try {
      const { data } =
        mode === 'edit' && editingRelation?.id
          ? await updateGraphRelation(graphId, editingRelation.id, payload)
          : await createGraphRelation(graphId, payload);

      if (data?.code === 0) {
        const relation = data.data?.relation as GraphRelation | undefined;
        await applyServerGraph(data.data?.graph);
        if (relation) {
          setEditingRelation(relation);
          setMode('edit');
          relationForm.setFieldsValue({
            ...relation,
            source: String(relation.source),
            target: String(relation.target),
            source_detail: joinListValue(relation.source_detail),
          });
        }
        message.success(mode === 'create' ? '关系已创建' : '关系已保存');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntity = async (record: GraphEntity) => {
    const { data } = await deleteGraphEntity(graphId, record.id);
    if (data?.code === 0) {
      await applyServerGraph(data.data?.graph);
      if (editingEntity && String(editingEntity.id) === String(record.id)) {
        openEntityEditor('create');
      }
      message.success('节点已删除');
    }
  };

  const handleDeleteRelation = async (record: GraphRelation) => {
    if (!record.id) return;
    const recordKey = record.id || `${record.source}-${record.target}`;
    const { data } = await deleteGraphRelation(graphId, record.id);
    if (data?.code === 0) {
      await applyServerGraph(data.data?.graph);
      if (
        editingRelation &&
        (editingRelation.id ||
          `${editingRelation.source}-${editingRelation.target}`) === recordKey
      ) {
        openRelationEditor('create');
      }
      message.success('关系已删除');
    }
  };

  const handleExportGraph = async () => {
    setExporting(true);
    try {
      const response = await exportGraphSnapshot(graphId);
      const contentDisposition =
        response.response?.headers?.get?.('content-disposition') ||
        response.response?.headers?.get?.('Content-Disposition');
      const matchedName = contentDisposition?.match(/filename="?([^"]+)"?/i);
      const filename = matchedName?.[1]
        ? decodeURIComponent(matchedName[1])
        : 'knowledge_graph_新.json';
      downloadFileFromBlob(new Blob([response.data]), filename);
    } finally {
      setExporting(false);
    }
  };

  const entityColumns: ColumnsType<GraphEntity> = [
    {
      title: '节点',
      dataIndex: 'entity_name',
      key: 'entity_name',
      width: 180,
      render: (text: string, record) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-slate-900">{text}</div>
          <div className="text-xs text-slate-400">ID: {record.id}</div>
        </div>
      ),
    },
    {
      title: '类型',
      dataIndex: 'entity_type',
      key: 'entity_type',
      width: 120,
      render: (type?: string) => <Tag color="blue">{type || 'ENTITY'}</Tag>,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text?: string) =>
        text || <span className="text-slate-400">-</span>,
    },
    {
      title: '操作',
      key: 'action',
      width: 130,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="编辑节点">
            <Button
              variant="ghost"
              size="sm"
              className="size-8 p-0"
              onClick={() => openEntityEditor('edit', record)}
            >
              <PencilLine className="size-4" />
            </Button>
          </Tooltip>
          <Popconfirm
            title="删除节点"
            description="删除节点会同时移除与它相关的关系。"
            okText="删除"
            cancelText="取消"
            onConfirm={() => handleDeleteEntity(record)}
          >
            <Tooltip title="删除节点">
              <Button
                variant="ghost"
                size="sm"
                className="size-8 p-0 text-red-600 hover:text-red-700"
              >
                <Trash2 className="size-4" />
              </Button>
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const relationColumns: ColumnsType<GraphRelation> = [
    {
      title: '起点',
      dataIndex: 'source',
      key: 'source',
      width: 150,
      render: (id: number | string) => nodeNameById.get(String(id)) || id,
    },
    {
      title: '关系',
      dataIndex: 'relation',
      key: 'relation',
      width: 140,
      render: (text: string) => <Tag color="geekblue">{text}</Tag>,
    },
    {
      title: '终点',
      dataIndex: 'target',
      key: 'target',
      width: 150,
      render: (id: number | string) => nodeNameById.get(String(id)) || id,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text?: string) =>
        text || <span className="text-slate-400">-</span>,
    },
    {
      title: '操作',
      key: 'action',
      width: 130,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="编辑关系">
            <Button
              variant="ghost"
              size="sm"
              className="size-8 p-0"
              onClick={() => openRelationEditor('edit', record)}
            >
              <PencilLine className="size-4" />
            </Button>
          </Tooltip>
          <Popconfirm
            title="删除关系"
            okText="删除"
            cancelText="取消"
            onConfirm={() => handleDeleteRelation(record)}
          >
            <Tooltip title="删除关系">
              <Button
                variant="ghost"
                size="sm"
                className="size-8 p-0 text-red-600 hover:text-red-700"
              >
                <Trash2 className="size-4" />
              </Button>
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const footer =
    activeTarget === 'entity' ? (
      <Space>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          取消
        </Button>
        <Button type="button" disabled={saving} onClick={handleSubmitEntity}>
          {mode === 'create' ? '创建节点' : '保存节点'}
        </Button>
      </Space>
    ) : (
      <Space>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          取消
        </Button>
        <Button type="button" disabled={saving} onClick={handleSubmitRelation}>
          {mode === 'create' ? '创建关系' : '保存关系'}
        </Button>
      </Space>
    );

  const trigger =
    variant === 'button' ? (
      <Button
        type="button"
        variant="outline"
        className="gap-2"
        onClick={() => openEntityEditor('create')}
      >
        <CirclePlus className="size-4" />
        快捷维护
      </Button>
    ) : (
      <section className="rounded-lg border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-violet-50 text-violet-600">
              <Network className="size-5" />
            </div>
            <div>
              <h3 className="font-medium text-slate-900">手动维护图谱</h3>
              <p className="text-sm text-slate-500">
                用于少量节点和关系的增删改。
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="gap-2"
              onClick={() => openEntityEditor('create')}
            >
              <CirclePlus className="size-4" />
              维护节点和关系
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              disabled={exporting}
              onClick={handleExportGraph}
            >
              <Download className="size-4" />
              导出图谱
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-xs text-slate-500">节点字段</div>
            <div className="mt-1 text-sm text-slate-800">
              名称、类型、别名、描述、来源
            </div>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-xs text-slate-500">关系字段</div>
            <div className="mt-1 text-sm text-slate-800">
              起点、终点、关系类型、描述、来源
            </div>
          </div>
        </div>
      </section>
    );

  return (
    <>
      {trigger}

      <Modal
        width={1040}
        open={open}
        title="图谱节点与关系维护"
        onCancel={() => setOpen(false)}
        footer={footer}
        destroyOnClose
      >
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0">
            <Tabs
              activeKey={activeTarget}
              onChange={(key) => setActiveTarget(key as EditorTarget)}
              items={[
                {
                  key: 'entity',
                  label: `节点 (${filteredEntities.length}/${graph.nodes.length})`,
                  children: (
                    <div className="space-y-3">
                      <Input
                        allowClear
                        value={entitySearch}
                        onChange={(event) =>
                          setEntitySearch(event.target.value)
                        }
                        prefix={<Search className="size-4 text-slate-400" />}
                        placeholder="搜索节点名称、类型、别名、描述或来源"
                      />
                      <Table
                        rowKey={(record) => String(record.id)}
                        loading={loadingGraph}
                        size="small"
                        columns={entityColumns}
                        dataSource={filteredEntities}
                        pagination={{ pageSize: 6, showSizeChanger: false }}
                      />
                    </div>
                  ),
                },
                {
                  key: 'relation',
                  label: `关系 (${filteredRelations.length}/${graph.edges.length})`,
                  children: (
                    <div className="space-y-3">
                      <Input
                        allowClear
                        value={relationSearch}
                        onChange={(event) =>
                          setRelationSearch(event.target.value)
                        }
                        prefix={<Search className="size-4 text-slate-400" />}
                        placeholder="搜索起点、终点、关系类型、描述或来源"
                      />
                      <Table
                        rowKey={(record, index) =>
                          record.id ||
                          `${record.source}-${record.target}-${index}`
                        }
                        loading={loadingGraph}
                        size="small"
                        columns={relationColumns}
                        dataSource={filteredRelations}
                        pagination={{ pageSize: 6, showSizeChanger: false }}
                      />
                    </div>
                  ),
                },
              ]}
            />
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <Typography.Text strong>
                {activeTarget === 'entity'
                  ? mode === 'create'
                    ? '新增节点'
                    : '编辑节点'
                  : mode === 'create'
                    ? '新增关系'
                    : '编辑关系'}
              </Typography.Text>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2"
                onClick={() =>
                  activeTarget === 'entity'
                    ? openEntityEditor('create')
                    : openRelationEditor('create')
                }
              >
                <Edit3 className="size-4" />
                清空
              </Button>
            </div>

            {activeTarget === 'entity' ? (
              <Form form={entityForm} layout="vertical" preserve={false}>
                <Form.Item
                  label="节点名称"
                  name="entity_name"
                  rules={[{ required: true, message: '请输入节点名称' }]}
                >
                  <Input placeholder="例如：高超声速飞行器" />
                </Form.Item>
                <Form.Item label="节点类型" name="entity_type">
                  <Select
                    showSearch
                    placeholder="选择或输入类型"
                    options={[
                      { value: 'PERSON', label: 'PERSON' },
                      { value: 'ORGANIZATION', label: 'ORGANIZATION' },
                      { value: 'LOCATION', label: 'LOCATION' },
                      { value: 'EVENT', label: 'EVENT' },
                      { value: 'CONCEPT', label: 'CONCEPT' },
                      { value: 'ENTITY', label: 'ENTITY' },
                    ]}
                  />
                </Form.Item>
                <Form.Item label="别名" name="aliases">
                  <Input.TextArea
                    rows={2}
                    placeholder="多个别名用逗号或换行分隔"
                  />
                </Form.Item>
                <Form.Item label="描述" name="description">
                  <Input.TextArea rows={4} placeholder="补充节点说明" />
                </Form.Item>
                <Form.Item label="来源" name="source">
                  <Input.TextArea
                    rows={2}
                    placeholder="文件名、段落编号或人工维护说明"
                  />
                </Form.Item>
              </Form>
            ) : (
              <Form
                form={relationForm}
                layout="vertical"
                preserve={false}
                onValuesChange={(changedValues, allValues) => {
                  setRelationDraft(allValues);
                  console.log('[ManualGraphEditor] relation form changed:', {
                    changedValues,
                    allValues,
                  });
                }}
              >
                <Form.Item
                  label="起点节点"
                  name="source"
                  rules={[{ required: true, message: '请选择起点节点' }]}
                >
                  <Select
                    showSearch
                    placeholder="选择起点节点"
                    options={entityOptions}
                    optionFilterProp="label"
                    optionLabelProp="displayName"
                    optionRender={(option) => (
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {option.data.displayName}
                        </span>
                        <span className="text-xs text-slate-400">
                          {option.data.entityType} / ID: {option.data.nodeId}
                        </span>
                      </div>
                    )}
                  />
                </Form.Item>
                <Form.Item
                  label="终点节点"
                  name="target"
                  rules={[{ required: true, message: '请选择终点节点' }]}
                >
                  <Select
                    showSearch
                    placeholder="选择终点节点"
                    options={entityOptions}
                    optionFilterProp="label"
                    optionLabelProp="displayName"
                    optionRender={(option) => (
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {option.data.displayName}
                        </span>
                        <span className="text-xs text-slate-400">
                          {option.data.entityType} / ID: {option.data.nodeId}
                        </span>
                      </div>
                    )}
                  />
                </Form.Item>
                <Form.Item
                  label="关系类型"
                  name="relation"
                  rules={[{ required: true, message: '请输入关系类型' }]}
                >
                  <Input placeholder="例如：隶属于、研发、位于" />
                </Form.Item>
                <Form.Item label="描述" name="description">
                  <Input.TextArea rows={3} placeholder="补充关系说明" />
                </Form.Item>
                <Form.Item label="来源" name="source_detail">
                  <Input.TextArea
                    rows={2}
                    placeholder="多个来源用逗号或换行分隔"
                  />
                </Form.Item>
              </Form>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
