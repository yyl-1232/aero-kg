from api.db.db_models import KnowledgeGraph
from api.db.services.common_service import CommonService
from api.db import StatusEnum
from api.db.db_models import DB, Tenant

class KnowledgeGraphService(CommonService):
    model = KnowledgeGraph

    @classmethod
    @DB.connection_context()
    def get_detail(cls, graph_id):
        """获取知识图谱详细信息"""
        fields = [
            cls.model.id,
            cls.model.name,
            cls.model.description,
            cls.model.permission,
            cls.model.node_num,
            cls.model.edge_num,
            cls.model.create_time,
            cls.model.update_time,
        ]

        graphs = (
            cls.model
            .select(*fields)
            .join(
                Tenant,
                on=(
                        (Tenant.id == cls.model.tenant_id) &
                        (Tenant.status == StatusEnum.VALID.value)
                )
            )
            .where(
                (cls.model.id == graph_id),
                (cls.model.status == StatusEnum.VALID.value)
            )
        )

        if not graphs:
            return None

        return graphs[0].to_dict()


