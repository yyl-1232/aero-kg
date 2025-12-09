import { useTranslation } from 'react-i18next';

export default function KnowledgeGraphConfiguration() {
  const { t } = useTranslation();

  return (
    <div className="p-6">
      <h2>知识图谱配置</h2>
      <p>配置页面内容</p>
    </div>
  );
}
