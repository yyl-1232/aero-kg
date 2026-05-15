import time

from api import settings
from flask import Blueprint
from flask_login import login_required, current_user
from flask import current_app, request

from api.db.services.document_service import DocumentService
from api.db.services.file_service import FileService
from api.utils.api_utils import server_error_response, get_data_error_result, validate_request, get_json_result, \
    send_file_in_mem, \
    token_required
from api.utils import get_uuid
from api.db import StatusEnum, FileType, FileSource, TenantPermission
from api.db.services.knowledge_graph_service import KnowledgeGraphService
from api.db.services.neo4j_service import Neo4jKnowledgeGraphService
from api.db.services.user_service import UserTenantService
from api.constants import DATASET_NAME_LIMIT
from api.db.services import duplicate_name
from rag.utils.storage_factory import STORAGE_IMPL
from api.db.db_models import User

manager = Blueprint("graph", __name__)
from api.utils import current_timestamp, datetime_format
from datetime import datetime
from api.db.services import duplicate_name


def _get_readable_graph(graph_id):
    joined_tenant_ids = [
        tenant.tenant_id
        for tenant in UserTenantService.query(user_id=current_user.id)
    ]
    graphs = KnowledgeGraphService.model.select().where(
        (KnowledgeGraphService.model.id == graph_id)
        & (KnowledgeGraphService.model.status == "1")
        & (
            (KnowledgeGraphService.model.tenant_id == current_user.id)
            | (
                KnowledgeGraphService.model.tenant_id.in_(joined_tenant_ids)
                & (KnowledgeGraphService.model.permission == TenantPermission.TEAM.value)
            )
        )
    )
    return graphs[0] if graphs else None


def _get_writable_graph(graph_id):
    graphs = KnowledgeGraphService.query(
        id=graph_id,
        tenant_id=current_user.id,
        status="1"
    )
    return graphs[0] if graphs else None


def _sync_graph_counts(graph_id):
    graph_data = Neo4jKnowledgeGraphService.read_graph(graph_id)
    KnowledgeGraphService.update_by_id(graph_id, {
        "node_num": len(graph_data.get("nodes", [])),
        "edge_num": len(graph_data.get("edges", [])),
        "update_time": current_timestamp(),
    })
    graph = KnowledgeGraphService.get_by_id(graph_id)
    if graph and graph[1]:
        _sync_latest_graph_file(graph[1], graph_data)
    return graph_data


def _get_json_payload():
    req = request.json or {}
    if isinstance(req.get("data"), dict):
        return req["data"]
    return req


def _missing_required_payload(payload, *fields):
    return [field for field in fields if field not in payload]


def _missing_argument_result(missing_fields):
    return get_json_result(
        code=settings.RetCode.ARGUMENT_ERROR,
        message="required argument are missing: {}; ".format(
            ",".join(missing_fields)
        ),
    )


def _get_or_create_graph_folder(graph):
    root_folder = FileService.get_root_folder(graph.tenant_id)
    kg_folder = FileService.query(
        name=".knowledgegraph",
        parent_id=root_folder["id"],
        tenant_id=graph.tenant_id
    )
    if not kg_folder:
        kg_folder = FileService.insert({
            "id": get_uuid(),
            "parent_id": root_folder["id"],
            "tenant_id": graph.tenant_id,
            "created_by": graph.created_by,
            "name": ".knowledgegraph",
            "location": "",
            "size": 0,
            "type": FileType.FOLDER.value,
            "source_type": FileSource.KNOWLEDGEGRAPH
        })
    else:
        kg_folder = kg_folder[0]

    graph_folder = FileService.query(
        name=graph.name,
        parent_id=kg_folder.id,
        tenant_id=graph.tenant_id
    )
    if not graph_folder:
        graph_folder = FileService.insert({
            "id": get_uuid(),
            "parent_id": kg_folder.id,
            "tenant_id": graph.tenant_id,
            "created_by": graph.created_by,
            "name": graph.name,
            "location": "",
            "size": 0,
            "type": FileType.FOLDER.value,
            "source_type": FileSource.KNOWLEDGEGRAPH
        })
    else:
        graph_folder = graph_folder[0]

    return graph_folder


def _current_graph_export_payload(graph_data):
    return {
        "nodes": [
            {
                "id": node.get("id"),
                "entity_kwd": node.get("entity_name", ""),
                "label": node.get("entity_type") or "Entity",
                "aliases": node.get("aliases") or [],
                "description": node.get("description") or "",
                "source": node.get("source") or [],
            }
            for node in graph_data.get("nodes", [])
        ],
        "edges": [
            {
                "id": edge.get("id"),
                "head_entity_id": edge.get("source"),
                "tail_entity_id": edge.get("target"),
                "relation": edge.get("relation") or "",
                "description": edge.get("relation_description") or edge.get("description") or edge.get("relation") or "",
                "source": edge.get("source_detail") or [],
            }
            for edge in graph_data.get("edges", [])
        ],
    }


def _safe_graph_base_name(name):
    base_name = (name or "knowledge_graph").strip() or "knowledge_graph"
    if base_name.lower().endswith(".json"):
        base_name = base_name[:-5]
    return "".join(
        ch if ch not in r'\/:*?"<>|' else "_"
        for ch in base_name
    ).strip() or "knowledge_graph"


def _original_graph_base_name(graph):
    for file_id in graph.file_ids or []:
        ok, file = FileService.get_by_id(file_id)
        if not ok or not file:
            continue
        name = file.name or ""
        if not name.lower().endswith(".json"):
            continue
        if name.lower().endswith("_新.json"):
            continue
        return _safe_graph_base_name(name)
    return _safe_graph_base_name(graph.name)


def _sync_latest_graph_file(graph, graph_data=None):
    import json

    graph_data = graph_data or Neo4jKnowledgeGraphService.read_graph(graph.id)
    payload = _current_graph_export_payload(graph_data)
    blob = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
    graph_folder = _get_or_create_graph_folder(graph)
    safe_base_name = _original_graph_base_name(graph)
    latest_name = f"{safe_base_name}_新.json"
    latest_location = f"{graph.id}_latest_knowledge_graph.json"

    STORAGE_IMPL.put(graph_folder.id, latest_location, blob)

    latest_files = FileService.query(
        name=latest_name,
        parent_id=graph_folder.id,
        tenant_id=graph.tenant_id
    )
    if latest_files:
        latest_file = latest_files[0]
        FileService.update_by_id(latest_file.id, {
            "location": latest_location,
            "size": len(blob),
            "type": "json",
            "source_type": FileSource.KNOWLEDGEGRAPH,
        })
        latest_file_id = latest_file.id
    else:
        latest_file_id = get_uuid()
        FileService.insert({
            "id": latest_file_id,
            "parent_id": graph_folder.id,
            "tenant_id": graph.tenant_id,
            "created_by": graph.created_by,
            "type": "json",
            "name": latest_name,
            "location": latest_location,
            "size": len(blob),
            "source_type": FileSource.KNOWLEDGEGRAPH
        })

    file_ids = graph.file_ids or []
    if latest_file_id not in file_ids:
        KnowledgeGraphService.update_by_id(graph.id, {
            "file_ids": file_ids + [latest_file_id],
            "size": len(blob),
            "update_time": current_timestamp(),
        })
    else:
        KnowledgeGraphService.update_by_id(graph.id, {
            "size": len(blob),
            "update_time": current_timestamp(),
        })


@manager.route('/create', methods=['post'])
@login_required
@validate_request("name", "description")
def create_graph():
    current_app.logger.warning(
        f"[Create_FILES] HIT graph_id=, "
        f"method={request.method}, user={current_user.id}"
    )
    req = request.json
    graph_name = req["name"]
    if not isinstance(graph_name, str):
        return get_data_error_result(message="Graph name must be string.")
    if graph_name.strip() == "":
        return get_data_error_result(message="Graph name can't be empty.")

    try:
        graph_name = duplicate_name(
            KnowledgeGraphService.query,
            name=graph_name.strip(),
            tenant_id=current_user.id,
            status="1"
        )

        req["id"] = get_uuid()
        req["name"] = graph_name.strip()
        req["tenant_id"] = current_user.id
        req["created_by"] = current_user.id
        req["permission"] = req.get("permission", "me")
        if req["permission"] not in {TenantPermission.ME.value, TenantPermission.TEAM.value}:
            return get_data_error_result(message="Invalid graph permission.")
        req["node_num"] = 0
        req["edge_num"] = 0
        req["size"] = 0
        req["create_time"] = current_timestamp()
        req["update_time"] = current_timestamp()
        if not KnowledgeGraphService.insert(**req):
            return get_data_error_result(message="Create graph error")
        return get_json_result(data={"graph_id": req["id"]})
    except Exception as e:
        return server_error_response(e)

@manager.route('/graph_list', methods=['post'])
@login_required
def list_graphs():
    joined_tenant_ids = [
        tenant.tenant_id
        for tenant in UserTenantService.query(user_id=current_user.id)
    ]
    graphs = KnowledgeGraphService.model.select(
        KnowledgeGraphService.model,
        User.nickname,
        User.avatar.alias("tenant_avatar"),
    ).join(
        User,
        on=(KnowledgeGraphService.model.tenant_id == User.id),
    ).where(
        (
            (
                KnowledgeGraphService.model.tenant_id.in_(joined_tenant_ids)
                & (KnowledgeGraphService.model.permission == TenantPermission.TEAM.value)
            )
            | (KnowledgeGraphService.model.tenant_id == current_user.id)
        )
        & (KnowledgeGraphService.model.status == "1")
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


@manager.route('/update', methods=['post'])
@login_required
@validate_request("graph_id", "name")
def update_graph():
    req = request.json
    graph_id = req["graph_id"]
    graph_name = req["name"]

    if not isinstance(graph_name, str):
        return get_data_error_result(message="Graph name must be string.")

    graph_name = graph_name.strip()
    if graph_name == "":
        return get_data_error_result(message="Graph name can't be empty.")

    if len(graph_name) > DATASET_NAME_LIMIT:
        return get_data_error_result(
            message=f"Graph name length is {len(graph_name)} which is larger than {DATASET_NAME_LIMIT}"
        )

    graphs = KnowledgeGraphService.query(
        id=graph_id,
        tenant_id=current_user.id,
        status="1"
    )
    if not graphs or len(graphs) == 0:
        return get_data_error_result(message="Graph not found or no permission")

    duplicate_graphs = KnowledgeGraphService.query(
        name=graph_name,
        tenant_id=current_user.id,
        status="1"
    )
    if any(graph.id != graph_id for graph in duplicate_graphs):
        return get_data_error_result(message="Duplicated graph name.")

    graph = graphs[0]
    old_name = graph.name
    permission = req.get("permission", graph.permission)
    if permission not in {TenantPermission.ME.value, TenantPermission.TEAM.value}:
        return get_data_error_result(message="Invalid graph permission.")

    update_data = {
        "name": graph_name,
        "description": req.get("description", graph.description),
        "permission": permission,
        "update_time": current_timestamp(),
    }

    if not KnowledgeGraphService.update_by_id(graph_id, update_data):
        return get_data_error_result(message="Update graph error")

    if old_name != graph_name:
        root_folder = FileService.get_root_folder(current_user.id)
        kg_folder = FileService.query(
            name=".knowledgegraph",
            parent_id=root_folder["id"],
            tenant_id=current_user.id
        )
        if kg_folder:
            graph_folder = FileService.query(
                name=old_name,
                parent_id=kg_folder[0].id,
                tenant_id=current_user.id
            )
            if graph_folder:
                FileService.update_by_id(graph_folder[0].id, {"name": graph_name})

    return get_json_result(data=True)


@manager.route('/<graph_id>/delete', methods=['DELETE'])
@login_required
def delete_graph(graph_id):
    try:
        # 楠岃瘉鏉冮檺
        graphs = KnowledgeGraphService.query(
            id=graph_id,
            tenant_id=current_user.id,
            status="1"
        )

        if not graphs or len(graphs) == 0:
            return get_data_error_result(message="Graph not found or no permission")

            # 鍒犻櫎 .knowledgegraph 涓嬬殑瀵瑰簲鏂囦欢澶?
        from api.db.services.file_service import FileService
        from api.utils import get_uuid

        # 鑾峰彇鏍规枃浠跺す
        root_folder = FileService.get_root_folder(current_user.id)

        # 鏌ユ壘 .knowledgegraph 鏂囦欢澶?
        kg_folder = FileService.query(
            name=".knowledgegraph",
            parent_id=root_folder["id"],
            tenant_id=current_user.id
        )

        if kg_folder:
            kg_folder = kg_folder[0]
            # 鏌ユ壘瀵瑰簲鐨勫浘璋辨枃浠跺す
            graph_folder = FileService.query(
                name=graphs[0].name,
                parent_id=kg_folder.id,
                tenant_id=current_user.id
            )

            if graph_folder:
                # 绾ц仈鍒犻櫎鍥捐氨鏂囦欢澶瑰強鍏舵墍鏈夊唴瀹?
                FileService.delete_folder_by_pf_id(current_user.id, graph_folder[0].id)

                # 鍒犻櫎鐭ヨ瘑鍥捐氨
        Neo4jKnowledgeGraphService.delete_graph(graph_id)

        if not KnowledgeGraphService.delete_by_id(graph_id):
            return get_data_error_result(message="Delete graph error")

        return get_json_result(data=True)
    except Exception as e:
        return server_error_response(e)


@manager.route('/test', methods=['GET'])
def test():
    return get_json_result(data="Graph app is working")


@manager.route('/<graph_id>', methods=['GET'])
@login_required
def get_graph_detail(graph_id):
    graph = _get_readable_graph(graph_id)
    if not graph:
        return get_data_error_result(message="Graph not found or no permission")

    try:
        detail = KnowledgeGraphService.get_detail(graph_id)
        if not detail:
            return get_data_error_result(message="Graph not found")
        return get_json_result(data=detail)
    except Exception as e:
        return server_error_response(e)


@manager.route('/<graph_id>/upload_files', methods=['POST'])
@login_required
def upload_graph_files(graph_id):
    import json

    current_app.logger.warning(
        f"[UPLOAD_FILES] HIT graph_id={graph_id}, "
        f"method={request.method}, user={current_user.id}"
    )

    graph = KnowledgeGraphService.query(
        id=graph_id,
        tenant_id=current_user.id,
        status="1"
    )
    if not graph:
        return get_data_error_result(message="Graph not found or no permission")

    if 'files' not in request.files:
        return get_json_result(data=False, message='No files part!', code=400)

    files = [file for file in request.files.getlist('files') if file.filename]
    if len(files) != 1:
        return get_data_error_result(message="Please upload exactly one JSON knowledge graph file.")

    upload_file = files[0]
    if not upload_file.filename.lower().endswith(".json"):
        return get_data_error_result(message="Only JSON files are allowed.")

    if graph[0].node_num > 0 or graph[0].edge_num > 0 or graph[0].file_ids:
        return get_data_error_result(message="Knowledge graph file already exists.")

    def validate_graph_payload(payload):
        if not isinstance(payload, dict):
            raise ValueError("JSON root must be an object with nodes and edges.")
        nodes = payload.get("nodes")
        edges = payload.get("edges")
        if not isinstance(nodes, list):
            raise ValueError("Field nodes must be an array.")
        if not isinstance(edges, list):
            raise ValueError("Field edges must be an array.")

        node_ids = set()
        for index, node in enumerate(nodes, start=1):
            if not isinstance(node, dict):
                raise ValueError(f"nodes[{index}] must be an object.")
            for field in ["id", "entity_kwd"]:
                if field not in node:
                    raise ValueError(f"nodes[{index}] is missing required field: {field}.")
            node_ids.add(str(node["id"]))

        for index, edge in enumerate(edges, start=1):
            if not isinstance(edge, dict):
                raise ValueError(f"edges[{index}] must be an object.")
            for field in ["head_entity_id", "tail_entity_id", "relation"]:
                if field not in edge:
                    raise ValueError(f"edges[{index}] is missing required field: {field}.")
            if str(edge["head_entity_id"]) not in node_ids:
                raise ValueError(f"edges[{index}] references missing head_entity_id: {edge['head_entity_id']}.")
            if str(edge["tail_entity_id"]) not in node_ids:
                raise ValueError(f"edges[{index}] references missing tail_entity_id: {edge['tail_entity_id']}.")

        return nodes, edges

    try:
        root_folder = FileService.get_root_folder(current_user.id)
        kg_folder = FileService.query(
            name=".knowledgegraph",
            parent_id=root_folder["id"],
            tenant_id=current_user.id
        )
        if not kg_folder:
            kg_folder = FileService.insert({
                "id": get_uuid(),
                "parent_id": root_folder["id"],
                "tenant_id": current_user.id,
                "created_by": current_user.id,
                "name": ".knowledgegraph",
                "location": "",
                "size": 0,
                "type": FileType.FOLDER.value,
                "source_type": FileSource.KNOWLEDGEGRAPH
            })
        else:
            kg_folder = kg_folder[0]

        graph_folder = FileService.query(
            name=graph[0].name,
            parent_id=kg_folder.id,
            tenant_id=current_user.id
        )
        if not graph_folder:
            graph_folder = FileService.insert({
                "id": get_uuid(),
                "parent_id": kg_folder.id,
                "tenant_id": current_user.id,
                "created_by": current_user.id,
                "name": graph[0].name,
                "location": "",
                "size": 0,
                "type": FileType.FOLDER.value,
                "source_type": FileSource.KNOWLEDGEGRAPH
            })
        else:
            graph_folder = graph_folder[0]

        blob = upload_file.read()
        try:
            graph_payload = json.loads(blob.decode("utf-8-sig"))
            nodes_data, edges_data = validate_graph_payload(graph_payload)
        except UnicodeDecodeError:
            return get_data_error_result(message="JSON file must be UTF-8 encoded.")
        except json.JSONDecodeError as e:
            return get_data_error_result(message=f"JSON parse failed: {e}")
        except ValueError as e:
            return get_data_error_result(message=str(e))

        Neo4jKnowledgeGraphService.write_graph(graph_id, graph[0].name, nodes_data, edges_data)

        location = upload_file.filename
        while STORAGE_IMPL.obj_exist(graph_folder.id, location):
            location += "_"
        STORAGE_IMPL.put(graph_folder.id, location, blob)

        file_record = FileService.insert({
            "id": get_uuid(),
            "parent_id": graph_folder.id,
            "tenant_id": current_user.id,
            "created_by": current_user.id,
            "type": "json",
            "name": upload_file.filename,
            "location": location,
            "size": len(blob),
            "source_type": FileSource.KNOWLEDGEGRAPH
        })
        file_results = [file_record.to_json()]
        uploaded_file_ids = [file["id"] for file in file_results]
        current_file_ids = graph[0].file_ids or []

        KnowledgeGraphService.update_by_id(graph_id, {
            "node_num": len(nodes_data),
            "edge_num": len(edges_data),
            "file_ids": current_file_ids + uploaded_file_ids,
            "update_time": int(time.time() * 1000)
        })

        return get_json_result(data=file_results)
    except Exception as e:
        return server_error_response(e)


@manager.route('/<graph_id>/knowledge_graph', methods=['GET'])
@login_required
def get_neo4j_knowledge_graph(graph_id):
    graph = _get_readable_graph(graph_id)
    if not graph:
        return get_data_error_result(message="Graph not found or no permission")

    try:
        graph_data = Neo4jKnowledgeGraphService.read_graph(graph_id)
        return get_json_result(data={"graph": graph_data})
    except Exception as e:
        return server_error_response(e)


@manager.route('/<graph_id>/knowledge_graph/export', methods=['GET'])
@login_required
def export_neo4j_knowledge_graph(graph_id):
    graph = _get_readable_graph(graph_id)
    if not graph:
        return get_data_error_result(message="Graph not found or no permission")

    try:
        import json
        graph_data = Neo4jKnowledgeGraphService.read_graph(graph_id)
        payload = _current_graph_export_payload(graph_data)
        filename = f"{_original_graph_base_name(graph)}_新"
        return send_file_in_mem(
            json.dumps(payload, ensure_ascii=False, indent=2),
            f"{filename}.json",
        )
    except Exception as e:
        return server_error_response(e)


@manager.route('/<graph_id>/knowledge_graph/subgraph', methods=['POST'])
@login_required
@validate_request("entity_name")
def get_neo4j_subgraph(graph_id):
    graph = _get_readable_graph(graph_id)
    if not graph:
        return get_data_error_result(message="Graph not found or no permission")

    req = request.json
    try:
        subgraph = Neo4jKnowledgeGraphService.get_subgraph(
            graph_id,
            req["entity_name"],
            int(req.get("depth", 2)),
        )
        return get_json_result(data={"subgraph": subgraph})
    except Exception as e:
        return server_error_response(e)


@manager.route('/<graph_id>/knowledge_graph/retrieval_test', methods=['POST'])
@login_required
@validate_request("question")
def neo4j_knowledge_graph_retrieval_test(graph_id):
    graph = _get_readable_graph(graph_id)
    if not graph:
        return get_data_error_result(message="Graph not found or no permission")

    req = request.json
    try:
        result = Neo4jKnowledgeGraphService.retrieval_test(
            graph_id,
            req["question"],
            float(req.get("similarity_threshold", 0.3)),
            int(req.get("subgraph_depth", 2)),
        )
        return get_json_result(data=result)
    except Exception as e:
        return server_error_response(e)


@manager.route('/<graph_id>/knowledge_graph/entities', methods=['POST'])
@login_required
def create_neo4j_entity(graph_id):
    graph = _get_writable_graph(graph_id)
    if not graph:
        return get_data_error_result(message="Graph not found or no permission")

    req = _get_json_payload()
    missing_fields = _missing_required_payload(req, "entity_name")
    if missing_fields:
        return _missing_argument_result(missing_fields)
    try:
        entity = Neo4jKnowledgeGraphService.upsert_node(graph_id, graph.name, req)
        graph_data = _sync_graph_counts(graph_id)
        return get_json_result(data={"entity": entity, "graph": graph_data})
    except ValueError as e:
        return get_data_error_result(message=str(e))
    except Exception as e:
        return server_error_response(e)


@manager.route('/<graph_id>/knowledge_graph/entities/<entity_id>', methods=['PUT'])
@login_required
def update_neo4j_entity(graph_id, entity_id):
    graph = _get_writable_graph(graph_id)
    if not graph:
        return get_data_error_result(message="Graph not found or no permission")

    req = _get_json_payload()
    missing_fields = _missing_required_payload(req, "entity_name")
    if missing_fields:
        return _missing_argument_result(missing_fields)
    req["id"] = entity_id
    try:
        entity = Neo4jKnowledgeGraphService.upsert_node(graph_id, graph.name, req)
        graph_data = _sync_graph_counts(graph_id)
        return get_json_result(data={"entity": entity, "graph": graph_data})
    except ValueError as e:
        return get_data_error_result(message=str(e))
    except Exception as e:
        return server_error_response(e)


@manager.route('/<graph_id>/knowledge_graph/entities/<entity_id>', methods=['DELETE'])
@login_required
def delete_neo4j_entity(graph_id, entity_id):
    graph = _get_writable_graph(graph_id)
    if not graph:
        return get_data_error_result(message="Graph not found or no permission")

    try:
        Neo4jKnowledgeGraphService.delete_node(graph_id, entity_id)
        graph_data = _sync_graph_counts(graph_id)
        return get_json_result(data={"graph": graph_data})
    except Exception as e:
        return server_error_response(e)


@manager.route('/<graph_id>/knowledge_graph/relations', methods=['POST'])
@login_required
def create_neo4j_relation(graph_id):
    graph = _get_writable_graph(graph_id)
    if not graph:
        return get_data_error_result(message="Graph not found or no permission")

    req = _get_json_payload()
    missing_fields = _missing_required_payload(req, "source", "target", "relation")
    if missing_fields:
        return _missing_argument_result(missing_fields)
    try:
        relation = Neo4jKnowledgeGraphService.upsert_edge(graph_id, req)
        graph_data = _sync_graph_counts(graph_id)
        return get_json_result(data={"relation": relation, "graph": graph_data})
    except ValueError as e:
        return get_data_error_result(message=str(e))
    except Exception as e:
        return server_error_response(e)


@manager.route('/<graph_id>/knowledge_graph/relations/<relation_id>', methods=['PUT'])
@login_required
def update_neo4j_relation(graph_id, relation_id):
    graph = _get_writable_graph(graph_id)
    if not graph:
        return get_data_error_result(message="Graph not found or no permission")

    req = _get_json_payload()
    missing_fields = _missing_required_payload(req, "source", "target", "relation")
    if missing_fields:
        return _missing_argument_result(missing_fields)
    req["id"] = relation_id
    try:
        relation = Neo4jKnowledgeGraphService.upsert_edge(graph_id, req)
        graph_data = _sync_graph_counts(graph_id)
        return get_json_result(data={"relation": relation, "graph": graph_data})
    except ValueError as e:
        return get_data_error_result(message=str(e))
    except Exception as e:
        return server_error_response(e)


@manager.route('/<graph_id>/knowledge_graph/relations/<relation_id>', methods=['DELETE'])
@login_required
def delete_neo4j_relation(graph_id, relation_id):
    graph = _get_writable_graph(graph_id)
    if not graph:
        return get_data_error_result(message="Graph not found or no permission")

    try:
        Neo4jKnowledgeGraphService.delete_edge(graph_id, relation_id)
        graph_data = _sync_graph_counts(graph_id)
        return get_json_result(data={"graph": graph_data})
    except Exception as e:
        return server_error_response(e)


@manager.route('/<graph_id>/files', methods=['GET'])
@login_required
def get_graph_files(graph_id):
    """Get files associated with a knowledge graph."""
    graph = KnowledgeGraphService.get_by_id(graph_id)
    if not graph or not graph[1]:
        return get_data_error_result(message="Graph not found")

    file_ids = graph[1].file_ids or []
    files = DocumentService.get_by_ids(file_ids)
    return get_json_result(data=files)


@manager.route('/<graph_id>/files/<file_id>', methods=['DELETE'])
@login_required
def remove_graph_file(graph_id, file_id):
    """Remove a file association from a knowledge graph."""
    graph = KnowledgeGraphService.get_by_id(graph_id)
    if not graph or not graph[1]:
        return get_data_error_result(message="Graph not found")

    file_ids = graph[1].file_ids or []
    if file_id in file_ids:
        file_ids.remove(file_id)
        Neo4jKnowledgeGraphService.delete_graph(graph_id)
        KnowledgeGraphService.update_by_id(graph_id, {
            "file_ids": file_ids,
            "node_num": 0 if not file_ids else graph[1].node_num,
            "edge_num": 0 if not file_ids else graph[1].edge_num,
            "update_time": current_timestamp(),
        })

    return get_json_result(data=True)
