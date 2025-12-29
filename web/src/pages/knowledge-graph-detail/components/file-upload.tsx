import { Button } from '@/components/ui/button';
import { getAuthorization } from '@/utils/authorization-util';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle, FileText, Info, Upload, X, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'umi';

/* ================= 示例数据 ================= */
const entitiesExample = [
  {
    id: 1,
    entity_kwd: '高超声速飞行器',
    description:
      '高超声速飞行器是指在大气层内以马赫数大于5飞行、具有显著空气动力与热耦合效应的飞行器。',
    source: ['[web:1]', '[web:14]'],
  },
];

const relationsExample = [
  {
    head_entity_id: 1,
    tail_entity_id: 11,
    relation: '属于领域',
  },
];

/* ================= 校验规则 ================= */
const requiredEntityFields = ['id', 'entity_kwd', 'description', 'source'];
const requiredRelationFields = ['head_entity_id', 'tail_entity_id', 'relation'];

/* ================= Toast ================= */
const Toast = ({
  message,
  type,
  onClose,
}: {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}) => {
  const isError = type === 'error';
  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg border shadow-lg transition-all duration-300 transform ${
        isError
          ? 'bg-red-50 border-red-200 text-red-700'
          : 'bg-green-50 border-green-200 text-green-700'
      }`}
    >
      {isError ? (
        <XCircle className="h-5 w-5 flex-shrink-0" />
      ) : (
        <CheckCircle className="h-5 w-5 flex-shrink-0" />
      )}
      <span className="font-medium flex-1">{message}</span>
      <button
        onClick={onClose}
        className="flex-shrink-0 rounded-full p-1 hover:bg-gray-100 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

/* ================= Hover JSON 自适应 ================= */
const HoverJsonExample = ({
  data,
  parentRef,
}: {
  data: any;
  parentRef: React.RefObject<HTMLDivElement>;
}) => {
  const [position, setPosition] = useState<'left' | 'right'>('left');

  useEffect(() => {
    if (!parentRef.current) return;
    const rect = parentRef.current.getBoundingClientRect();
    // 当 Info 图标靠右，超过屏幕宽度 - 悬浮框宽度时向左展开
    if (rect.left + 320 > window.innerWidth) {
      setPosition('right');
    } else {
      setPosition('left');
    }
  }, [parentRef]);

  return (
    <div
      className={`
        absolute top-full mt-1 z-50 w-80 max-h-64 overflow-auto rounded-lg border border-gray-200 bg-white p-4 text-xs shadow-xl
        ${position === 'left' ? 'left-0' : 'right-0'}
      `}
    >
      <pre className="whitespace-pre-wrap break-all">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
};

/* ================= JSON 校验 ================= */
const validateEntityJson = async (file: File) => {
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data)) return { valid: false, error: 'JSON必须是数组' };
    for (const [i, item] of data.entries()) {
      for (const f of requiredEntityFields) {
        if (!(f in item))
          return { valid: false, error: `第${i + 1}条缺少字段 ${f}` };
      }
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'JSON解析失败' };
  }
};

const validateRelationJson = async (file: File) => {
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data)) return { valid: false, error: 'JSON必须是数组' };
    for (const [i, item] of data.entries()) {
      for (const f of requiredRelationFields) {
        if (!(f in item))
          return { valid: false, error: `第${i + 1}条缺少字段 ${f}` };
      }
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'JSON解析失败' };
  }
};

/* ================= UploadCard ================= */
interface UploadCardProps {
  title: string;
  description: string;
  example: any;
  file: File | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onRemove: () => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => Promise<void>;
  isDragging: boolean;
  setIsDragging: (value: boolean) => void;
  color: string;
}

const UploadCard = ({
  title,
  description,
  example,
  file,
  onFileChange,
  onRemove,
  onDrop,
  isDragging,
  setIsDragging,
  color,
}: UploadCardProps) => {
  const [hovered, setHovered] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex-1 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-300 hover:shadow-md hover:translate-y-[-2px]">
      <div className="flex justify-between items-center mb-2">
        <h3 className={`text-lg font-semibold ${color}`}>{title}</h3>
        <div
          ref={infoRef}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="relative"
        >
          <Info
            className={`h-5 w-5 cursor-pointer ${color} transition-colors hover:opacity-80`}
          />
          {hovered && <HoverJsonExample data={example} parentRef={infoRef} />}
        </div>
      </div>

      <p className="mb-3 text-sm text-gray-600">{description}</p>

      <div
        className={`border-2 border-dashed rounded-lg p-5 text-center transition-all duration-300 cursor-pointer
          ${
            isDragging
              ? `${color.replace('text', 'border')} bg-${color.replace('text-', '').replace('-600', '-50')} bg-opacity-50`
              : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
          }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
      >
        <Upload className={`mx-auto h-8 w-8 ${color} mb-2`} />
        <label className="cursor-pointer block">
          <span className="text-sm font-medium text-gray-800">
            拖拽文件到此处，或点击上传
          </span>
          <p className="text-xs text-gray-500 mt-1">仅支持 .json 格式文件</p>
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={onFileChange}
          />
        </label>
      </div>

      {file && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-gray-200 p-2 bg-gray-50 transition-all duration-200">
          <div className="flex items-center gap-2 flex-1">
            <FileText className={`h-5 w-5 ${color} flex-shrink-0`} />
            <span className="text-sm text-gray-800 truncate">{file.name}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-8 w-8 p-0 rounded-full hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

/* ================= 主组件 ================= */
export const FileUpload = () => {
  const { id: graphId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [entityFile, setEntityFile] = useState<File | null>(null);
  const [relationFile, setRelationFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const [dragEntity, setDragEntity] = useState(false);
  const [dragRelation, setDragRelation] = useState(false);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  /* ========== 文件选择 ========= */
  const handleEntityChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { valid, error } = await validateEntityJson(file);
    if (!valid) return showToast(error!, 'error');
    setEntityFile(file);
    e.target.value = '';
  };

  const handleRelationChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { valid, error } = await validateRelationJson(file);
    if (!valid) return showToast(error!, 'error');
    setRelationFile(file);
    e.target.value = '';
  };

  /* ========== 统一上传 ========= */
  const handleUploadAll = async () => {
    if (!entityFile || !relationFile || !graphId) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('files', entityFile);
    formData.append('files', relationFile);
    try {
      const res = await fetch(`/v1/graph/${graphId}/upload_files`, {
        method: 'POST',
        headers: { Authorization: getAuthorization() },
        body: formData,
      });
      const result = await res.json();
      if (res.ok && result.code === 0) {
        showToast('实体和关系上传成功', 'success');
        setEntityFile(null);
        setRelationFile(null);
        queryClient.invalidateQueries({ queryKey: ['fetchKnowledgeDetail'] });
      } else {
        showToast(result.message || '上传失败', 'error');
      }
    } catch {
      showToast('网络异常，上传失败', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8 md:p-12">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-10 text-center text-3xl md:text-4xl font-bold text-gray-800">
          知识图谱数据上传
        </h1>

        <div className="flex gap-6 flex-col md:flex-row">
          <UploadCard
            title="实体数据"
            description="上传包含完整字段的实体 JSON 文件，字段缺失将导致上传失败"
            example={entitiesExample}
            file={entityFile}
            onFileChange={handleEntityChange}
            onRemove={() => setEntityFile(null)}
            onDrop={async (e) => {
              e.preventDefault();
              setDragEntity(false);
              const file = e.dataTransfer.files[0];
              if (!file) return;
              const { valid, error } = await validateEntityJson(file);
              valid ? setEntityFile(file) : showToast(error!, 'error');
            }}
            isDragging={dragEntity}
            setIsDragging={setDragEntity}
            color="text-blue-600"
          />

          <UploadCard
            title="关系数据"
            description="上传包含头实体、尾实体和关系的 JSON 文件，字段缺失将导致上传失败"
            example={relationsExample}
            file={relationFile}
            onFileChange={handleRelationChange}
            onRemove={() => setRelationFile(null)}
            onDrop={async (e) => {
              e.preventDefault();
              setDragRelation(false);
              const file = e.dataTransfer.files[0];
              if (!file) return;
              const { valid, error } = await validateRelationJson(file);
              valid ? setRelationFile(file) : showToast(error!, 'error');
            }}
            isDragging={dragRelation}
            setIsDragging={setDragRelation}
            color="text-green-600"
          />
        </div>

        <div className="mt-12 flex justify-center">
          <Button
            disabled={!entityFile || !relationFile || uploading}
            onClick={handleUploadAll}
            style={{
              height: '5rem',
              paddingLeft: '1.5rem',
              paddingRight: '1.5rem',
            }}
            className="text-xl font-bold rounded-xl
                      bg-blue-500 border-2 border-blue-700
                      hover:bg-blue-600 hover:border-blue-800
                      active:bg-blue-700 active:border-blue-900
                      disabled:bg-gray-200 disabled:border-gray-300 disabled:cursor-not-allowed
                      shadow-lg hover:shadow-xl active:shadow-md transition-all duration-300
                      transform hover:translate-y-[-2px] active:translate-y-0 text-white"
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full"></span>
                上传中...
              </span>
            ) : (
              '确认上传'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
