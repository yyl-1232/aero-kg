import { UploadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { Button, Upload, message } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function KnowledgeGraphUpload() {
  const { t } = useTranslation();
  const [entityFile, setEntityFile] = useState<UploadFile | null>(null);
  const [relationFile, setRelationFile] = useState<UploadFile | null>(null);

  const handleEntityUpload = (file: UploadFile) => {
    setEntityFile(file);
    return false; // 阻止自动上传
  };

  const handleRelationUpload = (file: UploadFile) => {
    setRelationFile(file);
    return false;
  };

  const handleUpload = async () => {
    if (!entityFile || !relationFile) {
      message.warning(t('pleaseUploadBothFiles'));
      return;
    }
    // 实现上传逻辑
  };

  return (
    <div className="p-6">
      <h2>{t('uploadFiles')}</h2>

      <div className="mb-6">
        <h3>{t('entityFile')}</h3>
        <Upload
          beforeUpload={handleEntityUpload}
          maxCount={1}
          accept=".csv,.json,.xlsx"
        >
          <Button icon={<UploadOutlined />}>{t('selectEntityFile')}</Button>
        </Upload>
      </div>

      <div className="mb-6">
        <h3>{t('relationFile')}</h3>
        <Upload
          beforeUpload={handleRelationUpload}
          maxCount={1}
          accept=".csv,.json,.xlsx"
        >
          <Button icon={<UploadOutlined />}>{t('selectRelationFile')}</Button>
        </Upload>
      </div>

      <Button type="primary" onClick={handleUpload}>
        {t('upload')}
      </Button>
    </div>
  );
}
