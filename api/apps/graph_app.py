from flask import Blueprint
from flask import request
from flask_login import login_required, current_user
from api.utils.api_utils import server_error_response, get_data_error_result, validate_request, get_json_result
from api.utils import get_uuid
from api.db import StatusEnum
from api.db.services.knowledge_graph_service import KnowledgeGraphService
from api.constants import DATASET_NAME_LIMIT
from api.db.services import duplicate_name
manager = Blueprint("graph", __name__)

@manager.route('/create', methods=['post'])
@login_required
@validate_request("name", "description")
def create_graph():
    req = request.json
    graph_name = req["name"]
    if not isinstance(graph_name, str):
        return get_data_error_result(message="Graph name must be string.")
    if graph_name.strip() == "":
        return get_data_error_result(message="Graph name can't be empty.")

    try:
        req["id"] = get_uuid()
        req["name"] = graph_name.strip()
        req["tenant_id"] = current_user.id
        req["created_by"] = current_user.id
        req["permission"] = req.get("permission", "me")

        if not KnowledgeGraphService.save(**req):
            return get_data_error_result(message="Create graph error")
        return get_json_result(data={"graph_id": req["id"]})
    except Exception as e:
        return server_error_response(e)

@manager.route('/graph_list', methods=['post'])
@login_required
def list_graphs():
    graphs = KnowledgeGraphService.query(
        tenant_id=current_user.id,
        status="1"
    )
    graph_list = []
    if hasattr(graphs, 'dicts'):
        graph_list = list(graphs.dicts())
    elif isinstance(graphs, list):
        for g in graphs:
            if hasattr(g, 'to_dict'):
                graph_list.append(g.to_dict())
            else:
                graph_list.append({k: getattr(g, k) for k in g._meta.fields})
    return get_json_result(data={"graphs": graph_list, "total": len(graph_list)})


@manager.route('/<graph_id>/delete', methods=['DELETE'])
@login_required
def delete_graph(graph_id):
    try:
        # 验证权限
        graph = KnowledgeGraphService.query(
            id=graph_id,
            tenant_id=current_user.id,
            status="1"
        )

        if not graph:
            return get_data_error_result(message="Graph not found or no permission")

            # 删除知识图谱
        if not KnowledgeGraphService.delete_by_id(graph_id):
            return get_data_error_result(message="Delete graph error")

        return get_json_result(data=True)
    except Exception as e:
        return server_error_response(e)