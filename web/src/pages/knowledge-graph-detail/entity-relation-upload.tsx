import {
  FileUpload,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadList,
  FileUploadTrigger,
} from '@/components/file-upload';
import { Button } from '@/components/ui/button';
import { FileText, Info, Upload, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

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

// JSON悬浮提示框
const HoverJsonExample = ({ data }: { data: any }) => {
  return (
    <div className="absolute z-50 bg-white border shadow-lg p-4 rounded-lg w-96 max-h-64 overflow-auto text-xs">
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
};

// JSON字段校验
const validateJsonContent = async (
  file: File,
): Promise<{ valid: boolean; error?: string }> => {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (file.name.includes('entities')) {
      if (!Array.isArray(data))
        return { valid: false, error: 'JSON必须是数组' };

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
    } else if (file.name.includes('relations')) {
      if (!Array.isArray(data))
        return { valid: false, error: 'JSON必须是数组' };

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
    } else {
      return { valid: false, error: '文件名必须包含 entities 或 relations' };
    }

    return { valid: true };
  } catch (err) {
    return { valid: false, error: 'JSON解析错误' };
  }
};

// 文件格式校验
const validateFileFormat = (file: File): string | null => {
  const isJson =
    file.type === 'application/json' || file.name.endsWith('.json');
  if (!isJson) return '只支持JSON格式文件';

  const fileName = file.name.toLowerCase();
  if (!fileName.includes('entities') && !fileName.includes('relations')) {
    return '文件名必须包含entities或relations';
  }

  return null;
};

interface EntityRelationUploadProps {
  datasetId: string;
  onUploadSuccess?: () => void;
}

export function EntityRelationUpload({
  datasetId,
  onUploadSuccess,
}: EntityRelationUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [hovered, setHovered] = useState<'entities' | 'relations' | null>(null);

  const onUpload = async (files: File[]) => {
    setUploading(true);
    try {
      for (const file of files) {
        const formatError = validateFileFormat(file);
        if (formatError) {
          toast.error(`${file.name}: ${formatError}`);
          return;
        }

        const { valid, error } = await validateJsonContent(file);
        if (!valid) {
          toast.error(`${file.name}: ${error}`);
          return;
        }
      }

      const formData = new FormData();
      files.forEach((file) => formData.append('file', file));
      formData.append('parent_id', datasetId);

      const response = await fetch('/api/v1/file/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (response.ok) {
        toast.success('文件上传成功');
        setFiles([]);
        onUploadSuccess?.();
      } else {
        toast.error('上传失败');
      }
    } catch {
      toast.error('上传过程中发生错误');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 relative">
        {/* entities.json说明 */}
        <div className="flex items-center gap-1 relative">
          <span>entities.json: 包含实体信息</span>
          <div
            className="relative"
            onMouseEnter={() => setHovered('entities')}
            onMouseLeave={() => setHovered(null)}
          >
            <Info className="h-4 w-4 text-blue-600 cursor-pointer" />
            {hovered === 'entities' && (
              <HoverJsonExample data={entitiesExample} />
            )}
          </div>
        </div>

        {/* relations.json说明 */}
        <div className="flex items-center gap-1 relative mt-1">
          <span>relations.json: 包含关系信息</span>
          <div
            className="relative"
            onMouseEnter={() => setHovered('relations')}
            onMouseLeave={() => setHovered(null)}
          >
            <Info className="h-4 w-4 text-green-600 cursor-pointer" />
            {hovered === 'relations' && (
              <HoverJsonExample data={relationsExample} />
            )}
          </div>
        </div>
      </div>

      {/* 文件上传 */}
      <FileUpload
        value={files}
        onValueChange={setFiles}
        onUpload={onUpload}
        accept=".json,application/json"
        maxFiles={2}
        multiple
        onFileValidate={validateFileFormat}
      >
        <FileUploadDropzone className="border-dashed">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="rounded-full border border-dashed p-3">
              <Upload className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">拖拽文件到此处或点击上传</p>
            <p className="text-xs text-muted-foreground">
              支持entities.json和relations.json文件
            </p>
            <FileUploadTrigger asChild>
              <Button variant="outline" size="sm" disabled={uploading}>
                选择文件
              </Button>
            </FileUploadTrigger>
          </div>
        </FileUploadDropzone>

        <FileUploadList>
          {files.map((file, index) => (
            <FileUploadItem key={index} value={file}>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <FileUploadItemMetadata />
                <FileUploadItemDelete asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <X className="h-3 w-3" />
                  </Button>
                </FileUploadItemDelete>
              </div>
            </FileUploadItem>
          ))}
        </FileUploadList>
      </FileUpload>
    </div>
  );
}
