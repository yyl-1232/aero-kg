import { useFetchKnowledgeGraphDetail } from '@/hooks/graph-hooks';
import { Button } from 'antd';
import { useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'umi';

export function SideBar() {
  const { id } = useParams();
  const location = useLocation();

  // 添加类型检查
  if (!id) {
    return <div>Invalid ID</div>;
  }

  const { data } = useFetchKnowledgeGraphDetail(id);
  const navigate = useNavigate();

  const menuItems = [
    { key: 'upload', label: '上传文件', path: '/knowledge-graph/:id/upload' },
    { key: 'view', label: '查看图谱', path: '/knowledge-graph/:id/view' },
    {
      key: 'configuration',
      label: '配置设置',
      path: '/knowledge-graph/:id/configuration',
    },
  ];

  const handleMenuClick = useCallback(
    (key: string) => () => {
      const item = menuItems.find((item) => item.key === key);
      if (item) {
        navigate(item.path.replace(':id', id));
      }
    },
    [navigate, id],
  );

  return (
    <aside className="relative p-5 space-y-8">
      <div className="flex gap-2.5 max-w-[200px] items-center">
        <div className="text-lg font-semibold">
          {data?.name || 'Loading...'}
        </div>
      </div>
      <div className="w-[200px] flex flex-col gap-5">
        {menuItems.map((item) => {
          const active = location.pathname.endsWith(item.key);
          return (
            <Button
              key={item.key}
              variant={active ? 'secondary' : 'ghost'}
              onClick={handleMenuClick(item.key)}
            >
              {item.label}
            </Button>
          );
        })}
      </div>
    </aside>
  );
}
