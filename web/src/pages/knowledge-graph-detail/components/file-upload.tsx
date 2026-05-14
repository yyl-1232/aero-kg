import { Button } from '@/components/ui/button';
import { getAuthorization } from '@/utils/authorization-util';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, message } from 'antd';
import { FileText, Info, Upload, X } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'umi';

const graphExample = {
  nodes: [
    {
      id: 1,
      entity_kwd: '苹果公司',
      label: 'Organization',
      aliases: ['Apple Inc.', 'Apple'],
      description: '苹果公司是一家美国科技公司...',
      source: ['XXX'],
    },
    {
      id: 2,
      entity_kwd: '史蒂夫·乔布斯',
      label: 'Person',
      aliases: ['Steve Jobs'],
      description: ['史蒂夫·乔布斯是苹果公司的联合创始人兼首席执行官。', 'XXX'],
      source: ['XXX', ''],
    },
  ],
  edges: [
    {
      id: 'rel_001',
      head_entity_id: 1,
      tail_entity_id: 2,
      relation: '创办',
      source: ['XXX'],
    },
  ],
};

const requiredNodeFields = ['id', 'entity_kwd'];
const requiredEdgeFields = ['head_entity_id', 'tail_entity_id', 'relation'];

type Feedback = {
  type: 'success' | 'error' | 'info';
  text: string;
} | null;

interface FileUploadProps {
  onUploaded?: () => void;
}

const JsonExample = ({ data }: { data: any }) => {
  return (
    <div className="mt-4 max-h-96 overflow-auto rounded-lg border border-blue-100 bg-blue-50/40 p-4 text-xs shadow-sm">
      <pre className="whitespace-pre-wrap break-all text-slate-700">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
};

const validateGraphJson = async (file: File) => {
  try {
    const data = JSON.parse((await file.text()).replace(/^\uFEFF/, ''));
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { valid: false, error: 'JSON 根节点必须是对象' };
    }
    if (!Array.isArray(data.nodes)) {
      return { valid: false, error: 'nodes 必须是数组' };
    }
    if (!Array.isArray(data.edges)) {
      return { valid: false, error: 'edges 必须是数组' };
    }

    const nodeIds = new Set<string>();
    for (const [i, item] of data.nodes.entries()) {
      for (const field of requiredNodeFields) {
        if (!(field in item)) {
          return { valid: false, error: `第 ${i + 1} 个节点缺少字段 ${field}` };
        }
      }
      nodeIds.add(String(item.id));
    }

    for (const [i, item] of data.edges.entries()) {
      for (const field of requiredEdgeFields) {
        if (!(field in item)) {
          return { valid: false, error: `第 ${i + 1} 条关系缺少字段 ${field}` };
        }
      }
      if (!nodeIds.has(String(item.head_entity_id))) {
        return {
          valid: false,
          error: `第 ${i + 1} 条关系的 head_entity_id 不存在`,
        };
      }
      if (!nodeIds.has(String(item.tail_entity_id))) {
        return {
          valid: false,
          error: `第 ${i + 1} 条关系的 tail_entity_id 不存在`,
        };
      }
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'JSON 解析失败' };
  }
};

export const FileUpload = ({ onUploaded }: FileUploadProps) => {
  const { id: graphId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [graphFile, setGraphFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [exampleVisible, setExampleVisible] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const showFeedback = (type: NonNullable<Feedback>['type'], text: string) => {
    setFeedback({ type, text });
    if (type === 'success') message.success(text);
    if (type === 'error') message.error(text);
    if (type === 'info') message.info(text);
  };

  const acceptFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.json')) {
      showFeedback('error', '仅支持 .json 文件');
      return;
    }
    const { valid, error } = await validateGraphJson(file);
    if (!valid) {
      showFeedback('error', error!);
      return;
    }
    setGraphFile(file);
    showFeedback('info', '文件校验通过，请点击确认上传');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await acceptFile(file);
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (!graphFile || !graphId) return;
    setUploading(true);
    setFeedback({ type: 'info', text: '正在上传并写入 Neo4j...' });

    const formData = new FormData();
    formData.append('files', graphFile);

    try {
      const res = await fetch(`/v1/graph/${graphId}/upload_files`, {
        method: 'POST',
        headers: { Authorization: getAuthorization() },
        body: formData,
      });
      const result = await res.json();
      if (res.ok && result.code === 0) {
        setGraphFile(null);
        await queryClient.invalidateQueries({
          queryKey: ['fetchKnowledgeDetail'],
        });
        await queryClient.invalidateQueries({
          queryKey: ['fetchKnowledgeGraph'],
        });
        showFeedback('success', '知识图谱上传成功，已写入 Neo4j');
        onUploaded?.();
      } else {
        showFeedback('error', result.message || '上传失败');
      }
    } catch {
      showFeedback('error', '网络异常，上传失败');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-full bg-gray-50 p-8 md:p-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-800">
            知识图谱数据上传
          </h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExampleVisible((visible) => !visible)}
            className="gap-2"
          >
            <Info className="size-4 text-blue-600" />
            {exampleVisible ? '隐藏格式示例' : '查看格式示例'}
          </Button>
        </div>

        {exampleVisible && <JsonExample data={graphExample} />}

        {feedback && (
          <Alert
            className="mb-4"
            message={feedback.text}
            type={feedback.type}
            showIcon
            closable
            onClose={() => setFeedback(null)}
          />
        )}

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="mb-4 text-sm text-gray-600">上传知识图谱文件。</p>

          <div
            className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              dragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 bg-gray-50 hover:border-gray-400'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={async (e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files[0];
              if (file) await acceptFile(file);
            }}
          >
            <Upload className="mx-auto mb-3 size-9 text-blue-600" />
            <label className="block cursor-pointer">
              <span className="text-sm font-medium text-gray-800">
                拖拽文件到此处，或点击上传
              </span>
              <p className="mt-1 text-xs text-gray-500">仅支持 .json 格式</p>
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          </div>

          {graphFile && (
            <div className="mt-4 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="size-5 shrink-0 text-blue-600" />
                <span className="truncate text-sm text-gray-800">
                  {graphFile.name}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setGraphFile(null)}
                className="size-8 p-0"
              >
                <X className="size-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-center">
          <Button
            disabled={!graphFile || uploading}
            onClick={handleUpload}
            className="h-12 min-w-52 bg-blue-600 text-base font-semibold text-white hover:bg-blue-700"
          >
            {uploading ? '上传中...' : '确认上传'}
          </Button>
        </div>
      </div>
    </div>
  );
};
