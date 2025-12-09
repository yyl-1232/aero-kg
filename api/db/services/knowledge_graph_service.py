from api.db.db_models import KnowledgeGraph
from api.db.services.common_service import CommonService


class KnowledgeGraphService(CommonService):
    model = KnowledgeGraph