#
#  Copyright 2024 The InfiniFlow Authors. All Rights Reserved.
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#
import json
import logging

import requests
from flask import request
from flask_login import login_required, current_user

from api.db.services import duplicate_name
from api.db.services.document_service import DocumentService
from api.db.services.file2document_service import File2DocumentService
from api.db.services.file_service import FileService
from api.db.services.llm_service import LLMBundle
from api.db.services.user_service import TenantService, UserTenantService
from api.settings import RetCode
from api.utils.api_utils import server_error_response, get_data_error_result, validate_request, not_allowed_parameters
from api.utils import get_uuid
from api.db import StatusEnum, FileSource, LLMType
from api.db.services.knowledgebase_service import KnowledgebaseService
from api.db.db_models import File
from api.utils.api_utils import get_json_result
from api import settings
from graphrag.search import KGSearch
from rag.nlp import search
from api.constants import DATASET_NAME_LIMIT
from rag.nlp.search import index_name
from rag.settings import PAGERANK_FLD
from rag.utils.storage_factory import STORAGE_IMPL
from api.db.services.knowledge_graph_service import KnowledgeGraphService

from datetime import datetime
import jieba
from flask import Blueprint
# 添加这一行
manager = Blueprint("kb", __name__)

@manager.route('/create', methods=['post'])  # noqa: F821
@login_required
@validate_request("name")
def create():
    req = request.json
    dataset_name = req["name"]
    if not isinstance(dataset_name, str):
        return get_data_error_result(message="Dataset name must be string.")
    if dataset_name.strip() == "":
        return get_data_error_result(message="Dataset name can't be empty.")
    if len(dataset_name.encode("utf-8")) > DATASET_NAME_LIMIT:
        return get_data_error_result(
            message=f"Dataset name length is {len(dataset_name)} which is larger than {DATASET_NAME_LIMIT}")

    dataset_name = dataset_name.strip()
    dataset_name = duplicate_name(
        KnowledgebaseService.query,
        name=dataset_name,
        tenant_id=current_user.id,
        status=StatusEnum.VALID.value)
    try:
        req["id"] = get_uuid()
        req["name"] = dataset_name
        req["tenant_id"] = current_user.id
        req["created_by"] = current_user.id
        e, t = TenantService.get_by_id(current_user.id)
        if not e:
            return get_data_error_result(message="Tenant not found.")
        req["embd_id"] = t.embd_id
        if not KnowledgebaseService.save(**req):
            return get_data_error_result()
        return get_json_result(data={"kb_id": req["id"]})
    except Exception as e:
        return server_error_response(e)


@manager.route('/update', methods=['post'])  # noqa: F821
@login_required
@validate_request("kb_id", "name", "description", "parser_id")
@not_allowed_parameters("id", "tenant_id", "created_by", "create_time", "update_time", "create_date", "update_date", "created_by")
def update():
    req = request.json
    if not isinstance(req["name"], str):
        return get_data_error_result(message="Dataset name must be string.")
    if req["name"].strip() == "":
        return get_data_error_result(message="Dataset name can't be empty.")
    if len(req["name"].encode("utf-8")) > DATASET_NAME_LIMIT:
        return get_data_error_result(
            message=f"Dataset name length is {len(req['name'])} which is large than {DATASET_NAME_LIMIT}")
    req["name"] = req["name"].strip()

    if not KnowledgebaseService.accessible4deletion(req["kb_id"], current_user.id):
        return get_json_result(
            data=False,
            message='No authorization.',
            code=settings.RetCode.AUTHENTICATION_ERROR
        )
    try:
        if not KnowledgebaseService.query(
                created_by=current_user.id, id=req["kb_id"]):
            return get_json_result(
                data=False, message='Only owner of knowledgebase authorized for this operation.',
                code=settings.RetCode.OPERATING_ERROR)

        e, kb = KnowledgebaseService.get_by_id(req["kb_id"])
        if not e:
            return get_data_error_result(
                message="Can't find this knowledgebase!")

        if req["name"].lower() != kb.name.lower() \
                and len(
            KnowledgebaseService.query(name=req["name"], tenant_id=current_user.id, status=StatusEnum.VALID.value)) >= 1:
            return get_data_error_result(
                message="Duplicated knowledgebase name.")

        del req["kb_id"]
        if not KnowledgebaseService.update_by_id(kb.id, req):
            return get_data_error_result()

        if kb.pagerank != req.get("pagerank", 0):
            if req.get("pagerank", 0) > 0:
                settings.docStoreConn.update({"kb_id": kb.id}, {PAGERANK_FLD: req["pagerank"]},
                                         search.index_name(kb.tenant_id), kb.id)
            else:
                # Elasticsearch requires PAGERANK_FLD be non-zero!
                settings.docStoreConn.update({"exists": PAGERANK_FLD}, {"remove": PAGERANK_FLD},
                                         search.index_name(kb.tenant_id), kb.id)

        e, kb = KnowledgebaseService.get_by_id(kb.id)
        if not e:
            return get_data_error_result(
                message="Database error (Knowledgebase rename)!")
        kb = kb.to_dict()
        kb.update(req)

        return get_json_result(data=kb)
    except Exception as e:
        return server_error_response(e)


@manager.route('/detail', methods=['GET'])  # noqa: F821
@login_required
def detail():
    kb_id = request.args["kb_id"]
    try:
        tenants = UserTenantService.query(user_id=current_user.id)
        for tenant in tenants:
            if KnowledgebaseService.query(
                    tenant_id=tenant.tenant_id, id=kb_id):
                break
        else:
            return get_json_result(
                data=False, message='Only owner of knowledgebase authorized for this operation.',
                code=settings.RetCode.OPERATING_ERROR)
        kb = KnowledgebaseService.get_detail(kb_id)
        if not kb:
            return get_data_error_result(
                message="Can't find this knowledgebase!")
        kb["size"] = DocumentService.get_total_size_by_kb_id(kb_id=kb["id"],keywords="", run_status=[], types=[])
        return get_json_result(data=kb)
    except Exception as e:
        return server_error_response(e)


@manager.route('/list', methods=['POST'])  # noqa: F821
@login_required
def list_kbs():
    keywords = request.args.get("keywords", "")
    page_number = int(request.args.get("page", 0))
    items_per_page = int(request.args.get("page_size", 0))
    parser_id = request.args.get("parser_id")
    orderby = request.args.get("orderby", "create_time")
    if request.args.get("desc", "true").lower() == "false":
        desc = False
    else:
        desc = True

    req = request.get_json()
    owner_ids = req.get("owner_ids", [])
    try:
        if not owner_ids:
            tenants = TenantService.get_joined_tenants_by_user_id(current_user.id)
            tenants = [m["tenant_id"] for m in tenants]
            kbs, total = KnowledgebaseService.get_by_tenant_ids(
                tenants, current_user.id, page_number,
                items_per_page, orderby, desc, keywords, parser_id)
        else:
            tenants = owner_ids
            kbs, total = KnowledgebaseService.get_by_tenant_ids(
                tenants, current_user.id, 0,
                0, orderby, desc, keywords, parser_id)
            kbs = [kb for kb in kbs if kb["tenant_id"] in tenants]
            total = len(kbs)
            if page_number and items_per_page:
                kbs = kbs[(page_number-1)*items_per_page:page_number*items_per_page]
        return get_json_result(data={"kbs": kbs, "total": total})
    except Exception as e:
        return server_error_response(e)

@manager.route('/rm', methods=['post'])  # noqa: F821
@login_required
@validate_request("kb_id")
def rm():
    req = request.json
    if not KnowledgebaseService.accessible4deletion(req["kb_id"], current_user.id):
        return get_json_result(
            data=False,
            message='No authorization.',
            code=settings.RetCode.AUTHENTICATION_ERROR
        )
    try:
        kbs = KnowledgebaseService.query(
            created_by=current_user.id, id=req["kb_id"])
        if not kbs:
            return get_json_result(
                data=False, message='Only owner of knowledgebase authorized for this operation.',
                code=settings.RetCode.OPERATING_ERROR)

        for doc in DocumentService.query(kb_id=req["kb_id"]):
            if not DocumentService.remove_document(doc, kbs[0].tenant_id):
                return get_data_error_result(
                    message="Database error (Document removal)!")
            f2d = File2DocumentService.get_by_document_id(doc.id)
            if f2d:
                FileService.filter_delete([File.source_type == FileSource.KNOWLEDGEBASE, File.id == f2d[0].file_id])
            File2DocumentService.delete_by_document_id(doc.id)
        FileService.filter_delete(
            [File.source_type == FileSource.KNOWLEDGEBASE, File.type == "folder", File.name == kbs[0].name])
        if not KnowledgebaseService.delete_by_id(req["kb_id"]):
            return get_data_error_result(
                message="Database error (Knowledgebase removal)!")
        for kb in kbs:
            settings.docStoreConn.delete({"kb_id": kb.id}, search.index_name(kb.tenant_id), kb.id)
            settings.docStoreConn.deleteIdx(search.index_name(kb.tenant_id), kb.id)
            if hasattr(STORAGE_IMPL, 'remove_bucket'):
                STORAGE_IMPL.remove_bucket(kb.id)
        return get_json_result(data=True)
    except Exception as e:
        return server_error_response(e)


@manager.route('/<kb_id>/tags', methods=['GET'])  # noqa: F821
@login_required
def list_tags(kb_id):
    if not KnowledgebaseService.accessible(kb_id, current_user.id):
        return get_json_result(
            data=False,
            message='No authorization.',
            code=settings.RetCode.AUTHENTICATION_ERROR
        )

    tenants = UserTenantService.get_tenants_by_user_id(current_user.id)
    tags = []
    for tenant in tenants:
        tags += settings.retrievaler.all_tags(tenant["tenant_id"], [kb_id])
    return get_json_result(data=tags)


@manager.route('/tags', methods=['GET'])  # noqa: F821
@login_required
def list_tags_from_kbs():
    kb_ids = request.args.get("kb_ids", "").split(",")
    for kb_id in kb_ids:
        if not KnowledgebaseService.accessible(kb_id, current_user.id):
            return get_json_result(
                data=False,
                message='No authorization.',
                code=settings.RetCode.AUTHENTICATION_ERROR
            )

    tenants = UserTenantService.get_tenants_by_user_id(current_user.id)
    tags = []
    for tenant in tenants:
        tags += settings.retrievaler.all_tags(tenant["tenant_id"], kb_ids)
    return get_json_result(data=tags)


@manager.route('/<kb_id>/rm_tags', methods=['POST'])  # noqa: F821
@login_required
def rm_tags(kb_id):
    req = request.json
    if not KnowledgebaseService.accessible(kb_id, current_user.id):
        return get_json_result(
            data=False,
            message='No authorization.',
            code=settings.RetCode.AUTHENTICATION_ERROR
        )
    e, kb = KnowledgebaseService.get_by_id(kb_id)

    for t in req["tags"]:
        settings.docStoreConn.update({"tag_kwd": t, "kb_id": [kb_id]},
                                     {"remove": {"tag_kwd": t}},
                                     search.index_name(kb.tenant_id),
                                     kb_id)
    return get_json_result(data=True)


@manager.route('/<kb_id>/rename_tag', methods=['POST'])  # noqa: F821
@login_required
def rename_tags(kb_id):
    req = request.json
    if not KnowledgebaseService.accessible(kb_id, current_user.id):
        return get_json_result(
            data=False,
            message='No authorization.',
            code=settings.RetCode.AUTHENTICATION_ERROR
        )
    e, kb = KnowledgebaseService.get_by_id(kb_id)

    settings.docStoreConn.update({"tag_kwd": req["from_tag"], "kb_id": [kb_id]},
                                     {"remove": {"tag_kwd": req["from_tag"].strip()}, "add": {"tag_kwd": req["to_tag"]}},
                                     search.index_name(kb.tenant_id),
                                     kb_id)
    return get_json_result(data=True)


@manager.route('/<kb_id>/knowledge_graph', methods=['GET'])  # noqa: F821
@login_required
def knowledge_graph(kb_id):
    # 权限验证部分保持不变
    tenants = UserTenantService.query(user_id=current_user.id)

    for i, tenant in enumerate(tenants):
        kb_found = KnowledgeGraphService.query(
            tenant_id=tenant.tenant_id,
            id=kb_id,
            status="1"
        )
        if kb_found:
            break
    else:
        obj = {"graph": {}, "mind_map": {}}
        return get_json_result(data=obj)

    kb = kb_found[0]

    # 初始化返回对象
    obj = {"name": kb_found[0].name, "graph": {}, "mind_map": {}}

    # 从文件读取数据并转换为图谱格式
    graph_data = get_graph_data_from_files(kb)
    obj["graph"] = graph_data
    return get_json_result(data=obj)


def get_graph_data_from_files(kb):
    """从关联文件中读取实体和关系数据"""
    try:
        # 获取文件ID列表
        file_ids = kb.file_ids if kb.file_ids else []
        if not file_ids:
            return {"nodes": [], "edges": []}

        entities = []
        relations = []

        # 读取文件内容
        for file_id in file_ids:
            file_content = get_file_content(file_id)
            if not file_content:
                continue

            try:
                data = json.loads(file_content)
                if isinstance(data, list) and len(data) > 0:
                    # 判断是实体数组还是关系数组
                    if "entity_kwd" in data[0]:
                        entities.extend(data)
                    elif "head_entity_id" in data[0]:
                        relations.extend(data)
            except json.JSONDecodeError as e:
                continue

        return convert_to_graph_format(entities, relations)

    except Exception as e:
        return {"nodes": [], "edges": []}


def convert_to_graph_format(entities, relations):
    """将实体和关系数据转换为图谱格式"""
    # 创建实体ID到名称的映射
    entity_map = {str(entity["id"]): entity for entity in entities}

    # 转换节点
    nodes = []
    for entity in entities:
        nodes.append({
            "id": entity["id"],  # 使用原始ID
            "entity_name": entity["entity_kwd"],
            "description": entity.get("description", ""),
            "entity_type": "ENTITY",
            "source": entity.get("source", []),
            "pagerank": 1.0,
            "communities": []
        })

        # 转换边
    edges = []
    for relation in relations:
        head_id = str(relation["head_entity_id"])
        tail_id = str(relation["tail_entity_id"])

        if head_id in entity_map and tail_id in entity_map:
            edges.append({
                "source": entity_map[head_id]["id"],  # 🔧 修复：使用原始ID
                "target": entity_map[tail_id]["id"],  # 🔧 修复：使用原始ID
                "relation": relation.get("relation", ""),
                "weight": 2.0,
                "description": f"{relation.get('relation', '')}"
            })

    return {"nodes": nodes, "edges": edges}


def get_file_content(file_id):
    """获取文件内容（使用存储抽象层）"""
    try:
        from api.db.services.file_service import FileService
        from rag.utils.storage_factory import STORAGE_IMPL

        result = FileService.get_by_id(file_id)
        if not result or not result[0]:
            return None

        file_doc = result[1]
        # 1️⃣ 优先检查数据库内容字段
        if hasattr(file_doc, 'content') and file_doc.content:
            return file_doc.content

            # 2️⃣ 使用存储抽象层读取文件
        if hasattr(file_doc, 'parent_id') and hasattr(file_doc, 'location'):
            blob = STORAGE_IMPL.get(file_doc.parent_id, file_doc.location)
            if blob:
                return blob.decode('utf-8') if isinstance(blob, bytes) else blob

        return None

    except Exception as e:
        return None


@manager.route('/<kb_id>/knowledge_graph/subgraph', methods=['POST'])  # noqa: F821
@login_required
def get_subgraph(kb_id):
    """获取指定实体的子图"""
    data = request.get_json()
    entity_name = data.get('entity_name')
    depth = data.get('depth', 2)

    if not entity_name:
        return get_json_result(
            code=RetCode.OPERATING_ERROR,
            message='entity_name is required'
        )

        # 权限验证（复用现有逻辑）
    tenants = UserTenantService.query(user_id=current_user.id)
    kb_found = None
    for tenant in tenants:
        kb_found = KnowledgeGraphService.query(
            tenant_id=tenant.tenant_id,
            id=kb_id,
            status="1"
        )
        if kb_found:
            break

    if not kb_found:
        return get_json_result(data={"subgraph": {"nodes": [], "edges": []}})

    kb = kb_found[0]

    # 获取完整图谱数据
    graph_data = get_graph_data_from_files(kb)

    # 查找子图
    subgraph = extract_subgraph(graph_data, entity_name, depth)
    return get_json_result(data={"subgraph": subgraph})


def extract_subgraph(graph_data, entity_name, depth):
    """从完整图谱中提取指定实体的子图"""
    nodes = graph_data.get('nodes', [])
    edges = graph_data.get('edges', [])

    # 查找起始实体
    start_node = None
    for node in nodes:
        if node.get('entity_name') == entity_name:
            start_node = node
            break

    if not start_node:
        return {"nodes": [], "edges": []}

        # 使用BFS构建子图
    from collections import deque

    visited_nodes = set()
    visited_edges = set()
    queue = deque([(start_node['id'], 0)])

    while queue:
        current_node_id, current_depth = queue.popleft()

        if current_depth > depth:
            continue

        visited_nodes.add(current_node_id)

        # 查找相邻节点和边
        for edge in edges:
            source_id = edge.get('source')
            target_id = edge.get('target')

            if source_id == current_node_id and target_id not in visited_nodes:
                if current_depth < depth:
                    queue.append((target_id, current_depth + 1))
                visited_edges.add((source_id, target_id))
            elif target_id == current_node_id and source_id not in visited_nodes:
                if current_depth < depth:
                    queue.append((source_id, current_depth + 1))
                visited_edges.add((source_id, target_id))

                # 构建子图数据
    subgraph_nodes = [node for node in nodes if node['id'] in visited_nodes]
    subgraph_edges = [
        edge for edge in edges
        if (edge.get('source'), edge.get('target')) in visited_edges
    ]

    return {
        "nodes": subgraph_nodes,
        "edges": subgraph_edges
    }


def get_subgraph_internal(kb_id, entity_name, depth=2):
    """
    不依赖 Flask 的内部函数版 get_subgraph
    """
    # 获取知识图谱
    e, kb = KnowledgeGraphService.get_by_id(kb_id)
    if not e:
        return {"subgraph": {"nodes": [], "edges": []}}

    graph_data = get_graph_data_from_files(kb)
    subgraph = extract_subgraph(graph_data, entity_name, depth)
    return subgraph

@manager.route('/<kb_id>/knowledge_graph/retrieval_test', methods=['POST'])
@login_required
@validate_request("kb_id", "question")
def knowledge_graph_retrieval_test(kb_id):
    req = request.json
    question = req["question"]
    similarity_threshold = float(req.get("similarity_threshold", 0.3))
    subgraph_depth = int(req.get("subgraph_depth", 2))
    mode = req.get("mode", "text_match")

    # 校验用户权限
    tenants = UserTenantService.query(user_id=current_user.id)
    tenant_ids = []
    for tenant in tenants:
        if KnowledgeGraphService.query(tenant_id=tenant.tenant_id, id=kb_id):
            tenant_ids.append(tenant.tenant_id)
            break
    else:
        return get_json_result(
            data=False,
            message='Only owner of knowledge graph authorized for this operation.',
            code=settings.RetCode.OPERATING_ERROR
        )

    result = knowledge_graph_retrieval(kb_id, question, similarity_threshold, subgraph_depth, mode)

    if "error" in result:
        return get_data_error_result(message=result["error"])

    return get_json_result(data=result)

def knowledge_graph_retrieval(kb_id, question, similarity_threshold=0.3, subgraph_depth=2, mode="text_match"):
    """
    知识图谱检索核心逻辑
    1. 问题分词 → 匹配实体
    2. 以匹配实体为起点 → 获取子图
    3. 合并子图中的边作为 relationships
    """
    try:
        # ======================
        # 1. 校验知识图谱
        # ======================
        e, kb = KnowledgeGraphService.get_by_id(kb_id)
        if not e:
            return {"content_with_weight": "", "error": "Knowledge graph not found!"}

        # ======================
        # 2. 获取完整图谱
        # ======================
        graph_response = knowledge_graph(kb_id)
        if graph_response.status_code != 200:
            return {"content_with_weight": "", "error": "Failed to get knowledge graph data"}

        graph = graph_response.get_json()['data']['graph']
        nodes = graph.get('nodes', [])
        edges = graph.get('edges', [])

        # 构建 ID → 实体名 映射（非常关键）
        entity_id_to_name = {
            node['id']: node.get('entity_name')
            for node in nodes if node.get('id') is not None
        }

        # ======================
        # 3. 实体匹配
        # ======================
        matched_entities = []
        question_tokens = list(jieba.cut_for_search(question.lower()))

        for node in nodes:
            entity_name = node.get('entity_name', '')
            entity_desc = node.get('description', '')

            entity_name_lower = entity_name.lower()
            entity_desc_lower = entity_desc.lower()

            max_similarity = 0.0

            # 精确匹配
            if question.strip().lower() == entity_name_lower:
                max_similarity = 1.0
            else:
                for token in question_tokens:
                    if token in entity_name_lower:
                        sim = len(token) / len(entity_name_lower)
                    elif token in entity_desc_lower:
                        sim = len(token) / len(entity_desc_lower)
                    else:
                        sim = 1 - (
                            edit_distance(token, entity_name_lower) /
                            max(len(token), len(entity_name_lower))
                        ) if entity_name_lower else 0
                    max_similarity = max(max_similarity, sim)

            if max_similarity >= similarity_threshold:
                matched_entities.append({
                    "id": node.get("id"),
                    "entity_name": entity_name,
                    "entity_type": node.get("entity_type"),
                    "similarity": round(max_similarity, 4),
                    "description": entity_desc
                })

        matched_entities.sort(key=lambda x: x["similarity"], reverse=True)

        # 如果没有实体命中，直接返回
        if not matched_entities:
            return {
                "content_with_weight": "",
                "entities": [],
                "relationships": [],
                "chunk_id": get_uuid(),
                "doc_id": "",
                "docnm_kwd": "Knowledge Graph",
                "similarity": 0.0,
                "vector": []
            }

        # ======================
        # 4. 子图扩展（核心）
        # ======================
        all_edges = {}

        for entity in matched_entities:
            # 调用你已有的「非 Flask 版」子图函数
            subgraph = get_subgraph_internal(
                kb_id,
                entity["entity_name"],
                depth=subgraph_depth
            )
            # subgraph = {"nodes": [...], "edges": [...]}
            for edge in subgraph.get("edges", []):
                source_id = edge.get("source")
                target_id = edge.get("target")

                if source_id is None or target_id is None:
                    continue

                key = (source_id, target_id)

                all_edges[key] = {
                    "source_id": source_id,
                    "target_id": target_id,
                    "source": entity_id_to_name.get(source_id, str(source_id)),
                    "target": entity_id_to_name.get(target_id, str(target_id)),
                    "description": edge.get("description"),
                    "relation": edge.get("relation"),
                    "weight": edge.get("weight", 0)
                }

        matched_relationships = list(all_edges.values())
        # ======================
        # 5. 构建 content_with_weight
        # ======================
        entities_text = "\n".join(
            f"实体: {e['entity_name']} (类型: {e['entity_type']}, 相似度: {e['similarity']}) - {e['description']}"
            for e in matched_entities
        )

        relationships_text = "\n".join(
            f"关系: {r['source']} -> {r['target']} ({r.get('relation')})"
            for r in matched_relationships
        )

        content_with_weight = (
            "知识图谱检索结果:\n\n"
            f"{entities_text}\n\n"
            f"{relationships_text}"
        )

        # ======================
        # 6. 返回
        # ======================
        return {
            "content_with_weight": content_with_weight,
            "entities": matched_entities,
            "relationships": matched_relationships,
            "chunk_id": get_uuid(),
            "doc_id": "",
            "docnm_kwd": "Knowledge Graph",
            "similarity": 1.0,
            "vector": []
        }

    except Exception as e:
        return {"content_with_weight": "", "error": str(e)}





def edit_distance(s1, s2):
    """计算编辑距离"""
    if len(s1) < len(s2):
        return edit_distance(s2, s1)

    if len(s2) == 0:
        return len(s1)

    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row

    return previous_row[-1]


# @manager.route('/<kb_id>/knowledge_graph', methods=['GET'])  # noqa: F821
# @login_required
# def knowledge_graph(kb_id):
#     # # 调试信息：当前用户和知识库ID
#     debug_log(f"=== DEBUG: Knowledge Graph Access ===")
#     tenants = UserTenantService.query(user_id=current_user.id)
#
#     for i, tenant in enumerate(tenants):
#         debug_log(f"  Tenant {i + 1}: {tenant.tenant_id}")
#         # 使用 KnowledgeGraphService 查询自定义表
#         kb_found = KnowledgeGraphService.query(
#             tenant_id=tenant.tenant_id,
#             id=kb_id,
#             status="1"
#         )
#         # print(f"    KB found in tenant {tenant.tenant_id}: {bool(kb_found)}")
#         if kb_found:
#             debug_log(f"    KB details: id={kb_found[0].id}, name={kb_found[0].name}")
#             break
#     else:
#         debug_log("=== AUTHORIZATION FAILED ===")
#         debug_log("No tenant contained the requested knowledge base")
#         obj = {"graph": {}, "mind_map": {}}
#         return get_json_result(data=obj)
#
#     debug_log("=== AUTHORIZATION SUCCESS ===")
#     kb = kb_found[0]
#     debug_log(f"KB retrieved: tenant_id={kb.tenant_id}, name={kb.name}")
#
#     req = {
#         "kb_id": [kb_id],
#         "knowledge_graph_kwd": ["graph"]
#     }
#
#     obj = {"name": kb_found[0].name, "graph": {}, "mind_map": {}}
#     index_name = search.index_name(kb.tenant_id)
#     print(f"Checking index existence: {index_name}")
#
#     # if not settings.docStoreConn.indexExist(index_name, kb_id):
#     #     print("Index does not exist, returning empty graph")
#     #     return get_json_result(data=obj)
#     #
#     # sres = settings.retrievaler.search(req, index_name, [kb_id])
#     # print(f"Search results: {len(sres.ids)} documents found")
#     #
#     # if not len(sres.ids):
#     #     print("No graph data found, returning empty graph")
#     #     return get_json_result(data=obj)
#     #
#     # for id in sres.ids[:1]:
#     #     ty = sres.field[id]["knowledge_graph_kwd"]
#     #     print(f"Processing graph type: {ty}")
#     #     try:
#     #         content_json = json.loads(sres.field[id]["content_with_weight"])
#     #         print(f"Successfully parsed JSON with {len(content_json)} keys")
#     #     except Exception as e:
#     #         print(f"Failed to parse JSON: {e}")
#     #         continue
#     #
#     #     obj[ty] = content_json
#
#     # if "nodes" in obj["graph"]:
#     #     node_count = len(obj["graph"]["nodes"])
#     #     print(f"Processing {node_count} nodes")
#     #     obj["graph"]["nodes"] = sorted(obj["graph"]["nodes"], key=lambda x: x.get("pagerank", 0), reverse=True)[:256]
#     #     if "edges" in obj["graph"]:
#     #         edge_count = len(obj["graph"]["edges"])
#     #         print(f"Processing {edge_count} edges")
#     #         node_id_set = {o["id"] for o in obj["graph"]["nodes"]}
#     #         filtered_edges = [o for o in obj["graph"]["edges"] if
#     #                           o["source"] != o["target"] and o["source"] in node_id_set and o["target"] in node_id_set]
#     #         obj["graph"]["edges"] = sorted(filtered_edges, key=lambda x: x.get("weight", 0), reverse=True)[:128]
#     #         print(f"Filtered to {len(obj['graph']['edges'])} edges")
#
#     print("=== GRAPH DATA SUCCESSFULLY RETURNED ===")
#     return get_json_result(data=obj)


@manager.route('/<kb_id>/knowledge_graph', methods=['DELETE'])  # noqa: F821
@login_required
def delete_knowledge_graph(kb_id):
    if not KnowledgebaseService.accessible(kb_id, current_user.id):
        return get_json_result(
            data=False,
            message='No authorization.',
            code=settings.RetCode.AUTHENTICATION_ERROR
        )
    _, kb = KnowledgebaseService.get_by_id(kb_id)
    settings.docStoreConn.delete({"knowledge_graph_kwd": ["graph", "subgraph", "entity", "relation"]}, search.index_name(kb.tenant_id), kb_id)

    return get_json_result(data=True)


@manager.route("/get_meta", methods=["GET"])  # noqa: F821
@login_required
def get_meta():
    kb_ids = request.args.get("kb_ids", "").split(",")
    for kb_id in kb_ids:
        if not KnowledgebaseService.accessible(kb_id, current_user.id):
            return get_json_result(
                data=False,
                message='No authorization.',
                code=settings.RetCode.AUTHENTICATION_ERROR
            )
    return get_json_result(data=DocumentService.get_meta_by_kbs(kb_ids))


@manager.route('/graph/detail', methods=['GET'])  # noqa: F821
@login_required
def detail_graph():
    graph_id = request.args["kb_id"]
    try:
        tenants = UserTenantService.query(user_id=current_user.id)
        for tenant in tenants:
            if KnowledgeGraphService.query(
                    tenant_id=tenant.tenant_id, id=graph_id):
                break
        else:
            return get_json_result(
                data=False, message='Only owner of knowledge graph authorized for this operation.',
                code=settings.RetCode.OPERATING_ERROR)

        graph = KnowledgeGraphService.get_detail(graph_id)
        if not graph:
            return get_data_error_result(
                message="Can't find this knowledge graph!")
        return get_json_result(data=graph)
    except Exception as e:
        return server_error_response(e)