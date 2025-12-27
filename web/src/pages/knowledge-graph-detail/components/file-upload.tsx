import { Button } from '@/components/ui/button';
import { message } from 'antd';
import { Upload } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'umi';
interface FileUploadProps {
  onUploadSuccess?: () => void;
}

export const FileUpload = ({ onUploadSuccess }: FileUploadProps) => {
  const { t } = useTranslation();
  const { id } = useParams();
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<FileList | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(e.target.files);
  };

  const handleUpload = async () => {
    if (!files || !id) return;

    setUploading(true);
    const formData = new FormData();

    Array.from(files).forEach((file) => {
      formData.append('files', file);
    });

    try {
      const response = await fetch(`/api/v1/graph/${id}/upload_files`, {
        method: 'POST',
        body: formData,
        credentials: 'include', // 添加认证
      });

      const result = await response.json();

      if (response.ok && result.code === 0) {
        message.success('文件上传成功');
        onUploadSuccess?.();
        setFiles(null);
      } else {
        message.error(result.message || '上传失败');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      message.error('上传失败');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
        <div className="text-center">
          <Upload className="mx-auto h-12 w-12 text-gray-400" />
          <div className="mt-4">
            <label htmlFor="file-upload" className="cursor-pointer">
              <span className="mt-2 block text-sm font-medium text-gray-900">
                点击上传文件
              </span>
              <input
                id="file-upload"
                name="file-upload"
                type="file"
                className="sr-only"
                multiple
                accept=".json"
                onChange={handleFileChange}
              />
            </label>
            <p className="mt-1 text-xs text-gray-500">
              支持entities.json和relations.json文件
            </p>
          </div>
        </div>
      </div>

      {files && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">选择的文件：</h4>
          {Array.from(files).map((file, index) => (
            <div key={index} className="text-sm text-gray-600">
              {file.name}
            </div>
          ))}
        </div>
      )}

      <Button
        onClick={handleUpload}
        disabled={!files || uploading}
        className="w-full"
      >
        {uploading ? '上传中...' : '上传文件'}
      </Button>
    </div>
  );
};
