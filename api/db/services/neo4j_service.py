import logging
import os
from contextlib import contextmanager

from api.utils import get_base_config
from api.utils import get_uuid


class Neo4jKnowledgeGraphService:
    """Write uploaded knowledge graph JSON into Neo4j."""

    @staticmethod
    def _config():
        conf = get_base_config("neo4j", {}) or {}
        uri = os.environ.get("NEO4J_URI") or conf.get("uri")
        user = os.environ.get("NEO4J_USER") or conf.get("user")
        password = os.environ.get("NEO4J_PASSWORD") or conf.get("password")
        database = os.environ.get("NEO4J_DATABASE") or conf.get("database", "neo4j")
        enabled = os.environ.get("NEO4J_ENABLED")
        if enabled is None:
            enabled = conf.get("enabled", bool(uri and user and password))
        enabled = str(enabled).lower() not in {"0", "false", "no", "off", ""}
        return {
            "enabled": enabled,
            "uri": uri,
            "user": user,
            "password": password,
            "database": database,
        }

    @classmethod
    def is_enabled(cls):
        conf = cls._config()
        return bool(conf["enabled"] and conf["uri"] and conf["user"] and conf["password"])

    @classmethod
    @contextmanager
    def _driver(cls):
        if not cls.is_enabled():
            yield None
            return

        try:
            from neo4j import GraphDatabase
        except ImportError as exc:
            raise RuntimeError("Neo4j driver is not installed. Please install neo4j Python package.") from exc

        conf = cls._config()
        driver = GraphDatabase.driver(conf["uri"], auth=(conf["user"], conf["password"]))
        try:
            yield driver
        finally:
            driver.close()

    @staticmethod
    def _as_text(value):
        if isinstance(value, list):
            return "\n".join(str(item) for item in value if item is not None)
        if value is None:
            return ""
        return str(value)

    @staticmethod
    def _as_list(value):
        if value is None:
            return []
        if isinstance(value, list):
            return [str(item) for item in value if item is not None]
        return [str(value)]

    @staticmethod
    def _client_id(value):
        text = str(value)
        return int(text) if text.isdigit() else text

    @classmethod
    def _format_node(cls, node):
        return {
            "id": cls._client_id(node["node_id"]),
            "entity_name": node.get("entity_kwd") or "",
            "entity_type": node.get("label") or "Entity",
            "description": node.get("description") or "",
            "pagerank": 0,
            "communities": [],
            "source": list(node.get("source") or []),
            "aliases": list(node.get("aliases") or []),
        }

    @classmethod
    def _format_edge(cls, record):
        relation = record.get("relation") or ""
        return {
            "id": record.get("relation_id") or f'{record["source"]}-{record["target"]}-{relation}',
            "source": cls._client_id(record["source"]),
            "target": cls._client_id(record["target"]),
            "relation": relation,
            "description": record.get("description") or relation,
            "weight": float(record.get("weight") or 1),
            "source_detail": list(record.get("source_detail") or []),
        }

    @classmethod
    def write_graph(cls, graph_id, graph_name, nodes, edges):
        if not cls.is_enabled():
            return

        conf = cls._config()
        normalized_nodes = [
            {
                "id": str(node["id"]),
                "entity_kwd": str(node["entity_kwd"]),
                "label": str(node.get("label") or "Entity"),
                "aliases": cls._as_list(node.get("aliases")),
                "description": cls._as_text(node.get("description")),
                "source": cls._as_list(node.get("source")),
            }
            for node in nodes
        ]
        normalized_edges = [
            {
                "id": str(edge.get("id") or f'{edge["head_entity_id"]}-{edge["tail_entity_id"]}-{edge["relation"]}'),
                "head_entity_id": str(edge["head_entity_id"]),
                "tail_entity_id": str(edge["tail_entity_id"]),
                "relation": str(edge["relation"]),
                "description": cls._as_text(edge.get("description") or edge["relation"]),
                "weight": float(edge.get("weight") or 1),
                "source": cls._as_list(edge.get("source")),
            }
            for edge in edges
        ]

        with cls._driver() as driver:
            if not driver:
                return
            with driver.session(database=conf["database"]) as session:
                session.execute_write(cls._replace_graph, graph_id, graph_name, normalized_nodes, normalized_edges)

    @classmethod
    def read_graph(cls, graph_id):
        if not cls.is_enabled():
            return {"nodes": [], "edges": []}

        conf = cls._config()
        with cls._driver() as driver:
            if not driver:
                return {"nodes": [], "edges": []}
            with driver.session(database=conf["database"]) as session:
                nodes = [
                    cls._format_node(dict(record["n"]))
                    for record in session.run(
                        """
                        MATCH (n:KGNode {graph_id: $graph_id})
                        RETURN n
                        ORDER BY n.node_id
                        """,
                        graph_id=graph_id,
                    )
                ]
                edges = [
                    cls._format_edge(record.data())
                    for record in session.run(
                        """
                        MATCH (h:KGNode {graph_id: $graph_id})-[r:KG_RELATION]->(t:KGNode {graph_id: $graph_id})
                        RETURN h.node_id AS source,
                               t.node_id AS target,
                               r.relation_id AS relation_id,
                               r.relation AS relation,
                               r.description AS description,
                               r.weight AS weight,
                               r.source AS source_detail
                        ORDER BY source, target
                        """,
                        graph_id=graph_id,
                    )
                ]
                cls._apply_degree_rank(nodes, edges)
        return {"nodes": nodes, "edges": edges}

    @classmethod
    def _apply_degree_rank(cls, nodes, edges):
        degree_by_node_id = {node["id"]: 0 for node in nodes}
        for edge in edges:
            source = edge.get("source")
            target = edge.get("target")
            if source in degree_by_node_id:
                degree_by_node_id[source] += 1
            if target in degree_by_node_id:
                degree_by_node_id[target] += 1

        max_degree = max(degree_by_node_id.values(), default=0)
        for node in nodes:
            degree = degree_by_node_id.get(node["id"], 0)
            node["pagerank"] = round(degree / max_degree, 4) if max_degree else 0

    @classmethod
    def search_nodes(cls, graph_id, keyword, similarity_threshold=0.3, limit=20):
        """Search nodes with Neo4j exact/contains matching, then add edit-distance fuzzy fallback."""
        keyword = str(keyword or "").strip()
        if not keyword or not cls.is_enabled():
            return []

        tokens = cls._tokens(keyword)
        conf = cls._config()
        matches = {}

        with cls._driver() as driver:
            if not driver:
                return []
            with driver.session(database=conf["database"]) as session:
                records = session.run(
                    """
                    MATCH (n:KGNode {graph_id: $graph_id})
                    WITH n,
                         toLower($keyword) AS query,
                         $tokens AS tokens,
                         toLower(coalesce(n.entity_kwd, '')) AS name,
                         toLower(coalesce(n.description, '')) AS description,
                         [alias IN coalesce(n.aliases, []) | toLower(alias)] AS aliases
                    WITH n,
                         CASE
                           WHEN name = query OR query IN aliases THEN 1.0
                           WHEN name CONTAINS query OR any(alias IN aliases WHERE alias CONTAINS query) THEN 0.9
                           WHEN description CONTAINS query THEN 0.7
                           ELSE reduce(score = 0.0, token IN tokens |
                             CASE
                               WHEN token <> '' AND name CONTAINS token THEN CASE WHEN score < 0.75 THEN 0.75 ELSE score END
                               WHEN token <> '' AND any(alias IN aliases WHERE alias CONTAINS token) THEN CASE WHEN score < 0.7 THEN 0.7 ELSE score END
                               WHEN token <> '' AND description CONTAINS token THEN CASE WHEN score < 0.55 THEN 0.55 ELSE score END
                               ELSE score
                             END)
                         END AS score
                    WHERE score > 0
                    RETURN n, score
                    ORDER BY score DESC
                    LIMIT $limit
                    """,
                    graph_id=graph_id,
                    keyword=keyword.lower(),
                    tokens=tokens,
                    limit=int(limit),
                )
                for record in records:
                    node = cls._format_node(dict(record["n"]))
                    node["similarity"] = round(float(record["score"]), 4)
                    matches[node["id"]] = node

        if len(matches) >= limit:
            return sorted(matches.values(), key=lambda item: item["similarity"], reverse=True)

        # Neo4j community/core does not provide Levenshtein similarity by default.
        # This fallback catches typo-style fuzzy matches without requiring APOC.
        graph = cls.read_graph(graph_id)
        for node in graph["nodes"]:
            if node["id"] in matches:
                continue

            name = str(node.get("entity_name") or "").lower()
            aliases = [str(alias).lower() for alias in node.get("aliases", [])]
            score = max(
                [cls._similarity(keyword.lower(), name)]
                + [cls._similarity(keyword.lower(), alias) for alias in aliases]
            )

            if score >= similarity_threshold:
                node = dict(node)
                node["similarity"] = round(score, 4)
                matches[node["id"]] = node

        return sorted(matches.values(), key=lambda item: item["similarity"], reverse=True)[:limit]

    @staticmethod
    def _tokens(text):
        try:
            import jieba
            tokens = jieba.cut_for_search(str(text).lower())
        except Exception:
            tokens = str(text).lower().split()
        return [token.strip() for token in tokens if token and token.strip()]

    @classmethod
    def _find_subgraph_start_ids(cls, nodes, entity_name):
        query = str(entity_name or "").strip().lower()
        if not query:
            return set()

        def node_names(node):
            names = [node.get("entity_name")]
            names.extend(node.get("aliases") or [])
            return [str(name).strip().lower() for name in names if str(name or "").strip()]

        exact_ids = {
            node["id"]
            for node in nodes
            if query in node_names(node)
        }
        if exact_ids:
            return exact_ids

        contains_matches = [
            node
            for node in nodes
            if any(query in name or name in query for name in node_names(node))
        ]
        if contains_matches:
            contains_matches.sort(
                key=lambda node: min(
                    abs(len(query) - len(name))
                    for name in node_names(node)
                    if query in name or name in query
                )
            )
            return {contains_matches[0]["id"]}

        best_node = None
        best_score = 0.0
        for node in nodes:
            names = node_names(node)
            if not names:
                continue
            score = max(cls._similarity(query, name) for name in names)
            if score > best_score:
                best_score = score
                best_node = node

        return {best_node["id"]} if best_node and best_score >= 0.8 else set()

    @classmethod
    def get_subgraph(cls, graph_id, entity_name, depth=2):
        graph = cls.read_graph(graph_id)
        nodes = graph["nodes"]
        edges = graph["edges"]
        if not nodes:
            return {"nodes": [], "edges": []}

        depth = max(1, min(int(depth or 1), 5))
        start_ids = cls._find_subgraph_start_ids(nodes, entity_name)
        if not start_ids:
            return {"nodes": [], "edges": []}

        adjacency = {}
        for edge in edges:
            adjacency.setdefault(edge["source"], set()).add(edge["target"])
            adjacency.setdefault(edge["target"], set()).add(edge["source"])

        visited = set(start_ids)
        frontier = set(start_ids)
        for _ in range(depth):
            next_frontier = set()
            for node_id in frontier:
                next_frontier.update(adjacency.get(node_id, set()) - visited)
            visited.update(next_frontier)
            frontier = next_frontier
            if not frontier:
                break

        sub_nodes = [node for node in nodes if node["id"] in visited]
        sub_edges = [
            edge
            for edge in edges
            if edge["source"] in visited and edge["target"] in visited
        ]
        return {"nodes": sub_nodes, "edges": sub_edges}

    @classmethod
    def retrieval_test(cls, graph_id, question, similarity_threshold=0.3, subgraph_depth=2):
        graph = cls.read_graph(graph_id)
        nodes = graph["nodes"]
        if not nodes:
            return {
                "content_with_weight": "",
                "entities": [],
                "relationships": [],
                "chunk_id": get_uuid(),
                "doc_id": "",
                "docnm_kwd": "Knowledge Graph",
                "similarity": 0.0,
                "vector": [],
            }

        matched_entities = [
            {
                "id": node["id"],
                "entity_name": node.get("entity_name"),
                "entity_type": node.get("entity_type"),
                "similarity": node.get("similarity", 0),
                "description": node.get("description"),
            }
            for node in cls.search_nodes(
                graph_id,
                question,
                similarity_threshold=similarity_threshold,
                limit=50,
            )
            if node.get("similarity", 0) >= similarity_threshold
        ]

        relationship_map = {}
        for entity in matched_entities:
            subgraph = cls.get_subgraph(graph_id, entity["entity_name"], subgraph_depth)
            name_by_id = {node["id"]: node["entity_name"] for node in subgraph.get("nodes", [])}
            for edge in subgraph.get("edges", []):
                key = (edge["source"], edge["target"], edge.get("relation"))
                relationship_map[key] = {
                    "source_id": edge["source"],
                    "target_id": edge["target"],
                    "source": name_by_id.get(edge["source"], str(edge["source"])),
                    "target": name_by_id.get(edge["target"], str(edge["target"])),
                    "description": edge.get("description"),
                    "relation": edge.get("relation"),
                    "weight": edge.get("weight", 0),
                }

        relationships = list(relationship_map.values())
        entities_text = "\n".join(
            f"实体: {entity['entity_name']} (类型: {entity['entity_type']}, 相似度: {entity['similarity']}) - {entity['description']}"
            for entity in matched_entities
        )
        relationships_text = "\n".join(
            f"关系: {rel['source']} -> {rel['target']} ({rel.get('relation')})"
            for rel in relationships
        )

        return {
            "content_with_weight": f"知识图谱检索结果:\n\n{entities_text}\n\n{relationships_text}",
            "entities": matched_entities,
            "relationships": relationships,
            "chunk_id": get_uuid(),
            "doc_id": "",
            "docnm_kwd": "Knowledge Graph",
            "similarity": 1.0 if matched_entities else 0.0,
            "vector": [],
        }

    @staticmethod
    def _similarity(left, right):
        if not left or not right:
            return 0.0
        previous = range(len(right) + 1)
        for i, c1 in enumerate(left):
            current = [i + 1]
            for j, c2 in enumerate(right):
                current.append(min(
                    previous[j + 1] + 1,
                    current[j] + 1,
                    previous[j] + (c1 != c2),
                ))
            previous = current
        distance = previous[-1]
        return max(0.0, 1 - distance / max(len(left), len(right)))

    @staticmethod
    def _replace_graph(tx, graph_id, graph_name, nodes, edges):
        tx.run("MATCH (n:KGNode {graph_id: $graph_id}) DETACH DELETE n", graph_id=graph_id)
        tx.run(
            """
            MERGE (g:KnowledgeGraph {id: $graph_id})
            SET g.name = $graph_name, g.updated_at = timestamp()
            """,
            graph_id=graph_id,
            graph_name=graph_name,
        )
        tx.run(
            """
            UNWIND $nodes AS row
            MERGE (n:KGNode {graph_id: $graph_id, node_id: row.id})
            SET n.entity_kwd = row.entity_kwd,
                n.label = row.label,
                n.aliases = row.aliases,
                n.description = row.description,
                n.source = row.source
            WITH n
            MATCH (g:KnowledgeGraph {id: $graph_id})
            MERGE (g)-[:HAS_NODE]->(n)
            """,
            graph_id=graph_id,
            nodes=nodes,
        )
        tx.run(
            """
            UNWIND $edges AS row
            MATCH (h:KGNode {graph_id: $graph_id, node_id: row.head_entity_id})
            MATCH (t:KGNode {graph_id: $graph_id, node_id: row.tail_entity_id})
            MERGE (h)-[r:KG_RELATION {graph_id: $graph_id, relation_id: row.id}]->(t)
            SET r.relation = row.relation,
                r.description = row.description,
                r.weight = row.weight,
                r.source = row.source
            """,
            graph_id=graph_id,
            edges=edges,
        )

    @classmethod
    def upsert_node(cls, graph_id, graph_name, node):
        if not cls.is_enabled():
            return None

        normalized = {
            "id": str(node.get("id") or get_uuid()),
            "entity_kwd": str(node.get("entity_name") or node.get("entity_kwd") or "").strip(),
            "label": str(node.get("entity_type") or node.get("label") or "Entity").strip() or "Entity",
            "aliases": cls._as_list(node.get("aliases")),
            "description": cls._as_text(node.get("description")),
            "source": cls._as_list(node.get("source")),
        }
        if not normalized["entity_kwd"]:
            raise ValueError("Entity name can't be empty.")

        conf = cls._config()
        with cls._driver() as driver:
            if not driver:
                return None
            with driver.session(database=conf["database"]) as session:
                session.execute_write(cls._upsert_node, graph_id, graph_name, normalized)

        return cls._format_node({"node_id": normalized["id"], **normalized})

    @staticmethod
    def _upsert_node(tx, graph_id, graph_name, node):
        tx.run(
            """
            MERGE (g:KnowledgeGraph {id: $graph_id})
            SET g.name = $graph_name, g.updated_at = timestamp()
            MERGE (n:KGNode {graph_id: $graph_id, node_id: $node.id})
            SET n.entity_kwd = $node.entity_kwd,
                n.label = $node.label,
                n.aliases = $node.aliases,
                n.description = $node.description,
                n.source = $node.source
            MERGE (g)-[:HAS_NODE]->(n)
            """,
            graph_id=graph_id,
            graph_name=graph_name,
            node=node,
        )

    @classmethod
    def delete_node(cls, graph_id, node_id):
        if not cls.is_enabled():
            return

        conf = cls._config()
        with cls._driver() as driver:
            if not driver:
                return
            with driver.session(database=conf["database"]) as session:
                session.execute_write(cls._delete_node, graph_id, str(node_id))

    @staticmethod
    def _delete_node(tx, graph_id, node_id):
        tx.run(
            "MATCH (n:KGNode {graph_id: $graph_id, node_id: $node_id}) DETACH DELETE n",
            graph_id=graph_id,
            node_id=node_id,
        )

    @classmethod
    def upsert_edge(cls, graph_id, edge):
        if not cls.is_enabled():
            return None

        normalized = {
            "id": str(edge.get("id") or get_uuid()),
            "source": str(edge.get("source") or edge.get("head_entity_id") or "").strip(),
            "target": str(edge.get("target") or edge.get("tail_entity_id") or "").strip(),
            "relation": str(edge.get("relation") or "").strip(),
            "description": cls._as_text(edge.get("description") or edge.get("relation")),
            "weight": float(edge.get("weight") or 1),
            "source_detail": cls._as_list(edge.get("source_detail")),
        }
        if not normalized["source"] or not normalized["target"]:
            raise ValueError("Relation source and target are required.")
        if not normalized["relation"]:
            raise ValueError("Relation type can't be empty.")

        conf = cls._config()
        with cls._driver() as driver:
            if not driver:
                return None
            with driver.session(database=conf["database"]) as session:
                exists = session.execute_read(cls._nodes_exist, graph_id, normalized["source"], normalized["target"])
                if not exists:
                    raise ValueError("Relation source or target entity does not exist.")
                session.execute_write(cls._upsert_edge, graph_id, normalized)

        return cls._format_edge({
            "relation_id": normalized["id"],
            "source": normalized["source"],
            "target": normalized["target"],
            "relation": normalized["relation"],
            "description": normalized["description"],
            "weight": normalized["weight"],
            "source_detail": normalized["source_detail"],
        })

    @staticmethod
    def _nodes_exist(tx, graph_id, source, target):
        record = tx.run(
            """
            MATCH (s:KGNode {graph_id: $graph_id, node_id: $source})
            MATCH (t:KGNode {graph_id: $graph_id, node_id: $target})
            RETURN count(s) AS source_count, count(t) AS target_count
            """,
            graph_id=graph_id,
            source=source,
            target=target,
        ).single()
        return bool(record and record["source_count"] == 1 and record["target_count"] == 1)

    @staticmethod
    def _upsert_edge(tx, graph_id, edge):
        tx.run(
            """
            MATCH (:KGNode {graph_id: $graph_id})-[r:KG_RELATION {graph_id: $graph_id, relation_id: $edge.id}]->(:KGNode {graph_id: $graph_id})
            DELETE r
            """,
            graph_id=graph_id,
            edge=edge,
        )
        tx.run(
            """
            MATCH (h:KGNode {graph_id: $graph_id, node_id: $edge.source})
            MATCH (t:KGNode {graph_id: $graph_id, node_id: $edge.target})
            MERGE (h)-[r:KG_RELATION {graph_id: $graph_id, relation_id: $edge.id}]->(t)
            SET r.relation = $edge.relation,
                r.description = $edge.description,
                r.weight = $edge.weight,
                r.source = $edge.source_detail
            """,
            graph_id=graph_id,
            edge=edge,
        )

    @classmethod
    def delete_edge(cls, graph_id, relation_id):
        if not cls.is_enabled():
            return

        conf = cls._config()
        with cls._driver() as driver:
            if not driver:
                return
            with driver.session(database=conf["database"]) as session:
                session.execute_write(cls._delete_edge, graph_id, str(relation_id))

    @staticmethod
    def _delete_edge(tx, graph_id, relation_id):
        tx.run(
            """
            MATCH (:KGNode {graph_id: $graph_id})-[r:KG_RELATION {graph_id: $graph_id, relation_id: $relation_id}]->(:KGNode {graph_id: $graph_id})
            DELETE r
            """,
            graph_id=graph_id,
            relation_id=relation_id,
        )

    @classmethod
    def delete_graph(cls, graph_id):
        if not cls.is_enabled():
            return
        try:
            conf = cls._config()
            with cls._driver() as driver:
                if not driver:
                    return
                with driver.session(database=conf["database"]) as session:
                    session.execute_write(cls._delete_graph, graph_id)
        except Exception:
            logging.exception("Failed to delete knowledge graph from Neo4j")

    @staticmethod
    def _delete_graph(tx, graph_id):
        tx.run("MATCH (n:KGNode {graph_id: $graph_id}) DETACH DELETE n", graph_id=graph_id)
        tx.run("MATCH (g:KnowledgeGraph {id: $graph_id}) DETACH DELETE g", graph_id=graph_id)
