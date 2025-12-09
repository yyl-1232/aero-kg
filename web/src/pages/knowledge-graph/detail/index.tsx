import { PageHeader } from '@/components/page-header';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { useFetchKnowledgeGraphDetail } from '@/hooks/graph-hooks';
import { useNavigatePage } from '@/hooks/logic-hooks/navigate-hooks';
import { useTranslation } from 'react-i18next';
import { Outlet, useParams } from 'umi';
import { SideBar } from './sidebar';

export default function KnowledgeGraphDetail() {
  const { id } = useParams();
  const { navigateToKnowledgeGraphList } = useNavigatePage();
  const { t } = useTranslation();

  if (!id) {
    return <div>Invalid knowledge graph ID</div>;
  }

  const { data, loading } = useFetchKnowledgeGraphDetail(id);

  if (loading) return <div>Loading...</div>;

  return (
    <section className="flex h-full flex-col w-full">
      <PageHeader>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink onClick={navigateToKnowledgeGraphList}>
                {t('knowledgeGraph')}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="w-28 whitespace-nowrap text-ellipsis overflow-hidden">
                {data?.name || 'Loading...'}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </PageHeader>
      <div className="flex flex-1 min-h-0">
        <SideBar></SideBar>
        <div className="flex-1">
          <Outlet />
        </div>
      </div>
    </section>
  );
}
