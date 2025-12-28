import { Button } from '@/components/ui/button';
import { getAuthorization } from '@/utils/authorization-util';
import { CheckCircle, FileText, Info, Upload, X, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'umi';

interface FileUploadProps {
  onUploadSuccess?: () => void;
}

// 示例数据
const entitiesExample = [
  {
    id: 1,
    entity_kwd: '高超声速飞行器',
    description:
      '高超声速飞行器是指在大气层内以马赫数大于5飞行、具有显著空气动力与热耦合效应的飞行器。',
    source: ['[web:1]', '[web:14]', '[web:17]'],
  },
];

const relationsExample = [
  {
    head_entity_id: 1,
    tail_entity_id: 11,
    relation: '属于领域',
  },
];

// 必填字段定义
const requiredEntityFields = ['id', 'entity_kwd', 'description', 'source'];
const requiredRelationFields = ['head_entity_id', 'tail_entity_id', 'relation'];

// Toast组件
const Toast = ({
  message,
  type,
  onClose,
}: {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}) => {
  const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
  const Icon = type === 'success' ? CheckCircle : XCircle;

  return (
    <div
      className={`fixed top-4 right-4 ${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-in slide-in-from-top`}
    >
      <Icon className="h-5 w-5" />
      <span>{message}</span>
      <button onClick={onClose} className="ml-2">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

// JSON悬浮提示框
const HoverJsonExample = ({ data }: { data: any }) => {
  return (
    <div className="absolute left-0 top-6 z-50 bg-white border border-gray-200 shadow-xl p-4 rounded-lg w-80 max-h-64 overflow-auto text-xs">
      <pre className="text-gray-700">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
};

// JSON字段校验 - 实体
const validateEntityJson = async (
  file: File,
): Promise<{ valid: boolean; error?: string }> => {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!Array.isArray(data)) return { valid: false, error: 'JSON必须是数组' };

    for (const [index, item] of data.entries()) {
      for (const field of requiredEntityFields) {
        if (!(field in item))
          return {
            valid: false,
            error: `第${index + 1}条记录缺少字段: ${field}`,
          };
      }
      if (typeof item.id !== 'number')
        return { valid: false, error: `第${index + 1}条记录: id必须是数字` };
      if (typeof item.entity_kwd !== 'string')
        return {
          valid: false,
          error: `第${index + 1}条记录: entity_kwd必须是字符串`,
        };
      if (typeof item.description !== 'string')
        return {
          valid: false,
          error: `第${index + 1}条记录: description必须是字符串`,
        };
      if (!Array.isArray(item.source))
        return {
          valid: false,
          error: `第${index + 1}条记录: source必须是数组`,
        };
    }

    return { valid: true };
  } catch (err) {
    return { valid: false, error: 'JSON解析错误' };
  }
};

// JSON字段校验 - 关系
const validateRelationJson = async (
  file: File,
): Promise<{ valid: boolean; error?: string }> => {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!Array.isArray(data)) return { valid: false, error: 'JSON必须是数组' };

    for (const [index, item] of data.entries()) {
      for (const field of requiredRelationFields) {
        if (!(field in item))
          return {
            valid: false,
            error: `第${index + 1}条记录缺少字段: ${field}`,
          };
      }
      if (typeof item.head_entity_id !== 'number')
        return {
          valid: false,
          error: `第${index + 1}条记录: head_entity_id必须是数字`,
        };
      if (typeof item.tail_entity_id !== 'number')
        return {
          valid: false,
          error: `第${index + 1}条记录: tail_entity_id必须是数字`,
        };
      if (typeof item.relation !== 'string')
        return {
          valid: false,
          error: `第${index + 1}条记录: relation必须是字符串`,
        };
    }

    return { valid: true };
  } catch (err) {
    return { valid: false, error: 'JSON解析错误' };
  }
};

// 单个上传卡片组件
const UploadCard = ({
  title,
  type,
  example,
  file,
  onFileChange,
  onRemove,
  onUpload,
  uploading,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  color,
}: {
  title: string;
  type: 'entities' | 'relations';
  example: any;
  file: File | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
  onUpload: () => void;
  uploading: boolean;
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  color: string;
}) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div className="flex-1 p-6 bg-white rounded-xl border-2 border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="space-y-4">
        {/* 标题和说明 */}
        <div className="flex items-center justify-between">
          <h3 className={`text-lg font-semibold ${color}`}>{title}</h3>
          <div className="relative">
            <div
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
            >
              <Info
                className={`h-5 w-5 ${color} cursor-pointer hover:scale-110 transition-transform`}
              />
            </div>
            {hovered && <HoverJsonExample data={example} />}
          </div>
        </div>

        <p className="text-sm text-gray-600">
          {type === 'entities'
            ? '上传包含实体信息的JSON文件'
            : '上传包含关系信息的JSON文件'}
        </p>

        {/* 拖拽上传区域 */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 transition-all ${
            isDragging
              ? `${color.replace('text', 'border')} bg-opacity-10 ${color.replace('text', 'bg')}`
              : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
          }`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <div className="text-center">
            <Upload
              className={`mx-auto h-10 w-10 ${isDragging ? color : 'text-gray-400'} transition-colors`}
            />
            <div className="mt-3">
              <label htmlFor={`file-upload-${type}`} className="cursor-pointer">
                <span className="block text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors">
                  拖拽文件到此处或点击上传
                </span>
                <input
                  id={`file-upload-${type}`}
                  type="file"
                  className="sr-only"
                  accept=".json,application/json"
                  onChange={onFileChange}
                />
              </label>
              <p className="mt-1 text-xs text-gray-500">仅支持 .json 格式</p>
            </div>
          </div>
        </div>

        {/* 文件信息 */}
        {file && (
          <div className="p-3 border rounded-lg bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div
                  className={`p-2 rounded-lg ${color.replace('text', 'bg')} bg-opacity-10`}
                >
                  <FileText className={`h-5 w-5 ${color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRemove}
                className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* 上传按钮 */}
        <Button
          onClick={onUpload}
          disabled={!file || uploading}
          className={`w-full h-12 text-base font-semibold text-white ${
            type === 'entities'
              ? 'bg-blue-600 hover:bg-blue-700'
              : 'bg-green-600 hover:bg-green-700'
          } disabled:bg-gray-400 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg`}
        >
          {uploading ? (
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>上传中...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-blue-600">
              <Upload className="h-5 w-5" />
              <span>确认上传</span>
            </div>
          )}
        </Button>
      </div>
    </div>
  );
};

export const FileUpload = ({ onUploadSuccess }: FileUploadProps) => {
  const { id: graphId } = useParams<{ id: string }>();
  const [entityFile, setEntityFile] = useState<File | null>(null);
  const [relationFile, setRelationFile] = useState<File | null>(null);
  const [uploadingEntity, setUploadingEntity] = useState(false);
  const [uploadingRelation, setUploadingRelation] = useState(false);
  const [isDraggingEntity, setIsDraggingEntity] = useState(false);
  const [isDraggingRelation, setIsDraggingRelation] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // 实体文件处理
  const handleEntityFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (!e.target.files || !e.target.files[0]) return;

    const file = e.target.files[0];

    if (!file.name.endsWith('.json')) {
      showToast('只支持JSON格式文件', 'error');
      e.target.value = '';
      return;
    }

    const { valid, error } = await validateEntityJson(file);
    if (!valid) {
      showToast(`格式错误: ${error}`, 'error');
      e.target.value = '';
      return;
    }

    setEntityFile(file);
    e.target.value = '';
  };

  const handleEntityDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingEntity(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      showToast('只支持JSON格式文件', 'error');
      return;
    }

    const { valid, error } = await validateEntityJson(file);
    if (!valid) {
      showToast(`格式错误: ${error}`, 'error');
      return;
    }

    setEntityFile(file);
  };

  const handleEntityUpload = async () => {
    if (!entityFile || !graphId) return;

    setUploadingEntity(true);
    const formData = new FormData();
    formData.append('files', entityFile);

    try {
      const response = await fetch(`/v1/graph/${graphId}/upload_files`, {
        method: 'POST',
        headers: {
          Authorization: getAuthorization(),
        },
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.code === 0) {
        showToast('实体文件上传成功', 'success');
        setEntityFile(null);
        onUploadSuccess?.();
      } else {
        showToast(result.message || '实体文件上传失败', 'error');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      showToast('实体文件上传失败', 'error');
    } finally {
      setUploadingEntity(false);
    }
  };

  // 关系文件处理
  const handleRelationFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (!e.target.files || !e.target.files[0]) return;

    const file = e.target.files[0];

    if (!file.name.endsWith('.json')) {
      showToast('只支持JSON格式文件', 'error');
      e.target.value = '';
      return;
    }

    const { valid, error } = await validateRelationJson(file);
    if (!valid) {
      showToast(`格式错误: ${error}`, 'error');
      e.target.value = '';
      return;
    }

    setRelationFile(file);
    e.target.value = '';
  };

  const handleRelationDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingRelation(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      showToast('只支持JSON格式文件', 'error');
      return;
    }

    const { valid, error } = await validateRelationJson(file);
    if (!valid) {
      showToast(`格式错误: ${error}`, 'error');
      return;
    }

    setRelationFile(file);
  };

  const handleRelationUpload = async () => {
    if (!relationFile || !graphId) return;

    setUploadingRelation(true);
    const formData = new FormData();
    formData.append('files', relationFile);

    try {
      const response = await fetch(`/v1/graph/${graphId}/upload_files`, {
        method: 'POST',
        headers: {
          Authorization: getAuthorization(),
        },
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.code === 0) {
        showToast('关系文件上传成功', 'success');
        setRelationFile(null);
        onUploadSuccess?.();
      } else {
        showToast(result.message || '关系文件上传失败', 'error');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      showToast('关系文件上传失败', 'error');
    } finally {
      setUploadingRelation(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            知识图谱数据上传
          </h1>
          <p className="text-gray-600">
            分别上传实体和关系数据文件，系统将自动验证格式
          </p>
        </div>

        {/* 双栏布局 */}
        <div className="flex gap-6">
          {/* 左侧：实体上传 */}
          <UploadCard
            title="实体数据 (Entities)"
            type="entities"
            example={entitiesExample}
            file={entityFile}
            onFileChange={handleEntityFileChange}
            onRemove={() => setEntityFile(null)}
            onUpload={handleEntityUpload}
            uploading={uploadingEntity}
            isDragging={isDraggingEntity}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingEntity(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDraggingEntity(false);
            }}
            onDrop={handleEntityDrop}
            color="text-blue-600"
          />

          {/* 右侧：关系上传 */}
          <UploadCard
            title="关系数据 (Relations)"
            type="relations"
            example={relationsExample}
            file={relationFile}
            onFileChange={handleRelationFileChange}
            onRemove={() => setRelationFile(null)}
            onUpload={handleRelationUpload}
            uploading={uploadingRelation}
            isDragging={isDraggingRelation}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingRelation(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDraggingRelation(false);
            }}
            onDrop={handleRelationDrop}
            color="text-green-600"
          />
        </div>
      </div>
    </div>
  );
};
