import { Button } from '@/components/ui/button';
import graphService, { deleteGraph } from '@/services/graph-service';
import { formatPureDate } from '@/utils/date';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Modal, Radio, message } from 'antd';
import {
  Globe2,
  Lock,
  Settings2,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'umi';
import { FileUpload } from './file-upload';

type GraphManagementProps = {
  graphId: string;
  graphData: any;
  hasExistingFile: boolean;
  onUploaded: () => void;
};

const permissionOptions = [
  {
    value: 'me',
    title: '只有我',
    description: '仅图谱创建者可以查看、检索和管理这个知识图谱。',
    icon: Lock,
  },
  {
    value: 'team',
    title: '所有人',
    description: '团队内成员可以在知识图谱列表中看到并访问这个图谱。',
    icon: Globe2,
  },
];

export function GraphManagement({
  graphId,
  graphData,
  hasExistingFile,
  onUploaded,
}: GraphManagementProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [permission, setPermission] = useState(graphData?.permission || 'me');
  const [savingPermission, setSavingPermission] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setPermission(graphData?.permission || 'me');
  }, [graphData?.permission]);

  const currentPermission = useMemo(
    () => permissionOptions.find((item) => item.value === permission),
    [permission],
  );

  const handleSavePermission = async () => {
    if (!graphId || !graphData?.name) return;

    setSavingPermission(true);
    try {
      const { data } = await graphService.updateGraph({
        graph_id: graphId,
        name: graphData.name,
        description: graphData.description || '',
        permission,
      });

      if (data?.code === 0) {
        message.success('图谱共享权限已保存');
        queryClient.setQueryData(['fetchKnowledgeGraphDetail', graphId], {
          ...graphData,
          permission,
        });
        await queryClient.invalidateQueries({
          queryKey: ['fetchKnowledgeGraphDetail', graphId],
        });
        await queryClient.invalidateQueries({
          queryKey: ['fetchKnowledgeGraphList'],
        });
        await queryClient.invalidateQueries({
          queryKey: ['infiniteFetchKnowledgeGraphList'],
        });
      } else {
        message.error(data?.message || '权限保存失败');
      }
    } catch {
      message.error('网络异常，权限保存失败');
    } finally {
      setSavingPermission(false);
    }
  };

  const handleDeleteGraph = () => {
    Modal.confirm({
      title: '删除知识图谱',
      content:
        '删除后会移除图谱记录、关联文件以及 Neo4j 中的节点和关系，此操作不可恢复。',
      okText: '确认删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      async onOk() {
        setDeleting(true);
        try {
          const { data } = await deleteGraph(graphId);
          if (data?.code === 0) {
            message.success('知识图谱已删除');
            await queryClient.invalidateQueries({
              queryKey: ['fetchKnowledgeGraphList'],
            });
            await queryClient.invalidateQueries({
              queryKey: ['infiniteFetchKnowledgeGraphList'],
            });
            navigate('/knowledge-graph');
          } else {
            message.error(data?.message || '删除失败');
          }
        } finally {
          setDeleting(false);
        }
      },
    });
  };

  return (
    <div className="h-full overflow-auto bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">图谱管理</h2>
          <p className="mt-1 text-sm text-slate-500">
            管理图谱数据文件、访问权限和危险操作。
          </p>
        </div>

        <section className="rounded-lg border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                <UploadCloud className="size-5" />
              </div>
              <div>
                <h3 className="font-medium text-slate-900">上传图谱</h3>
                <p className="text-sm text-slate-500">请上传 JSON 格式文件。</p>
              </div>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
              {graphData?.node_num ?? 0} 节点 / {graphData?.edge_num ?? 0} 关系
            </div>
          </div>

          {hasExistingFile ? (
            <Alert
              type="success"
              showIcon
              message="已上传知识图谱文件"
              description="当前图谱已有数据文件。如需替换，请在文件管理中删除对应知识图谱文件后重新上传。"
            />
          ) : (
            <FileUpload onUploaded={onUploaded} />
          )}
        </section>

        <section className="rounded-lg border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h3 className="font-medium text-slate-900">共享图谱权限</h3>
              <p className="text-sm text-slate-500">
                控制哪些用户可以访问这个知识图谱。
              </p>
            </div>
          </div>

          <Radio.Group
            value={permission}
            onChange={(e) => setPermission(e.target.value)}
            className="grid w-full gap-3 md:grid-cols-2"
          >
            {permissionOptions.map((option) => {
              const Icon = option.icon;
              const active = permission === option.value;
              return (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded-lg border p-4 transition ${
                    active
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Radio value={option.value} />
                    <Icon
                      className={`mt-0.5 size-5 ${active ? 'text-blue-600' : 'text-slate-400'}`}
                    />
                    <div>
                      <div className="font-medium text-slate-900">
                        {option.title}
                      </div>
                      <div className="mt-1 text-sm leading-5 text-slate-500">
                        {option.description}
                      </div>
                    </div>
                  </div>
                </label>
              );
            })}
          </Radio.Group>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-sm text-slate-500">
              当前权限：{currentPermission?.title || '只有我'}
            </div>
            <Button disabled={savingPermission} onClick={handleSavePermission}>
              {savingPermission ? '保存中...' : '保存权限'}
            </Button>
          </div>
        </section>

        <section className="rounded-lg border border-red-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-md bg-red-50 text-red-600">
                <Trash2 className="size-5" />
              </div>
              <div>
                <h3 className="font-medium text-slate-900">删除图谱</h3>
                <p className="text-sm text-slate-500">
                  删除图谱记录、关联文件和 Neo4j
                  数据。建议仅在确认不再使用时操作。
                </p>
              </div>
            </div>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={handleDeleteGraph}
              className="gap-2"
            >
              <Trash2 className="size-4" />
              {deleting ? '删除中...' : '删除图谱'}
            </Button>
          </div>
        </section>

        <section className="rounded-lg border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-slate-100 text-slate-600">
              <Settings2 className="size-5" />
            </div>
            <div>
              <h3 className="font-medium text-slate-900">图谱信息</h3>
              <p className="text-sm text-slate-500">
                {graphData?.name || '未命名图谱'}，最近更新于{' '}
                {formatPureDate(
                  graphData?.update_time || graphData?.create_time,
                )}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
