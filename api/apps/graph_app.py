from flask import Blueprint
from flask_login import login_required, current_user
from flask import current_app, request
from api.db.services.file_service import FileService
from api.utils.api_utils import server_error_response, get_data_error_result, validate_request, get_json_result, \
    token_required
from api.utils import get_uuid
from api.db import StatusEnum, FileType, FileSource
from api.db.services.knowledge_graph_service import KnowledgeGraphService
from api.constants import DATASET_NAME_LIMIT
from api.db.services import duplicate_name
from rag.utils.storage_factory import STORAGE_IMPL

manager = Blueprint("graph", __name__)
from api.utils import current_timestamp, datetime_format
from datetime import datetime
from api.db.services import duplicate_name

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


@manager.route('/test', methods=['GET'])
def test():
    return get_json_result(data="Graph app is working")

@manager.route('/<graph_id>/upload_files', methods=['POST'])
@login_required
def upload_graph_files(graph_id):
    from api.db.services.knowledge_graph_service import KnowledgeGraphService
    from api.db.services.file_service import FileService
    from api.utils import get_uuid
    from rag.utils.storage_factory import STORAGE_IMPL
    current_app.logger.warning(
        f"[UPLOAD_FILES] HIT graph_id={graph_id}, "
        f"method={request.method}, user={current_user.id}"
    )
    # 验证图谱权限
    graph = KnowledgeGraphService.query(
        id=graph_id,
        tenant_id=current_user.id,
        status="1"
    )

    if not graph:
        return get_data_error_result(message="Graph not found or no permission")

    if 'files' not in request.files:
        return get_json_result(data=False, message='No files part!', code=400)

    files = request.files.getlist('files')

    try:
        # 获取根文件夹
        root_folder = FileService.get_root_folder(current_user.id)

        # 创建或获取.knowledgegraph文件夹
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
                "source_type": FileSource.KNOWLEDGEGRAPH  # 添加这行
            })
        else:
            kg_folder = kg_folder[0]

            # 创建图谱文件夹
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
                "source_type": FileSource.KNOWLEDGEGRAPH  # 添加这行
            })
        else:
            graph_folder = graph_folder[0]

        file_results = []
        for file in files:
            if file.filename == '':
                continue

                # 验证文件类型
            if file.filename not in ['entities.json', 'relations.json']:
                return get_data_error_result(message="Only entities.json and relations.json files are allowed")

                # 存储文件
            location = file.filename
            while STORAGE_IMPL.obj_exist(graph_folder.id, location):
                location += "_"

            blob = file.read()
            print(f"File {file.filename} size: {len(blob)} bytes")
            STORAGE_IMPL.put(graph_folder.id, location, blob)
            print(f"Stored file at: {graph_folder.id}/{location}")
            file_record = {
                "id": get_uuid(),
                "parent_id": graph_folder.id,
                "tenant_id": current_user.id,
                "created_by": current_user.id,
                "type": "json",
                "name": file.filename,
                "location": location,
                "size": len(blob),
                "source_type": FileSource.KNOWLEDGEGRAPH  # 添加这行
            }
            file_record = FileService.insert(file_record)
            print(f"Database record created: {file_record.id}")
            file_results.append(file_record.to_json())

        return get_json_result(data=file_results)
    except Exception as e:
        return server_error_response(e)