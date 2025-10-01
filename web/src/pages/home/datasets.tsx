import { IconFont } from '@/components/icon-font';
import { RenameDialog } from '@/components/rename-dialog';
import { Segmented, SegmentedValue } from '@/components/ui/segmented';
import { useFetchNextKnowledgeListByPage } from '@/hooks/use-knowledge-request';
import { Routes } from '@/routes';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DatasetCard, SeeAllCard } from '../datasets/dataset-card';
import { useRenameDataset } from '../datasets/use-rename-dataset';

export function Datasets() {
  const { t } = useTranslation();
  const { kbs, loading } = useFetchNextKnowledgeListByPage();
  const [activeTab, setActiveTab] = useState(Routes.Datasets);

  const options = useMemo(
    () => [{ value: Routes.Datasets, label: t('header.dataset') }],
    [t],
  );
  const handleChange = (path: SegmentedValue) => {
    setActiveTab(path as string);
  };
  const {
    datasetRenameLoading,
    initialDatasetName,
    onDatasetRenameOk,
    datasetRenameVisible,
    hideDatasetRenameModal,
    showDatasetRenameModal,
  } = useRenameDataset();

  return (
    <section className="mt-12">
      {/* 顶部标题 + Segmented */}
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-2xl font-bold flex gap-2.5 items-center">
          <IconFont name="data" className="size-8" />
          {options.find((x) => x.value === activeTab)?.label}
        </h2>
        <Segmented
          options={options}
          value={activeTab}
          onChange={handleChange}
          activeClassName="bg-[#3B82F6] text-white border-none"
          className="bg-bg-card border border-border-button rounded-full"
          // activeClassName="bg-text-primary border-none"
        />
      </div>

      {/* 内容区域 */}
      <div className="flex gap-6">
        {activeTab === Routes.Datasets && (
          <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8 max-h-[78vh] overflow-auto">
            {kbs
              ?.slice(0, 6)
              .map((dataset) => (
                <DatasetCard
                  key={dataset.id}
                  dataset={dataset}
                  showDatasetRenameModal={showDatasetRenameModal}
                />
              ))}
            <div className="min-h-24">
              <SeeAllCard />
            </div>
          </div>
        )}
      </div>

      {/* 重命名弹窗 */}
      {datasetRenameVisible && (
        <RenameDialog
          hideModal={hideDatasetRenameModal}
          onOk={onDatasetRenameOk}
          initialName={initialDatasetName}
          loading={datasetRenameLoading}
        />
      )}
    </section>
  );
}
