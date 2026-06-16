import { Card, CardContent } from '@/components/ui/card';
import { Docagg, IReferenceChunk } from '@/interfaces/database/chat';
import { Network } from 'lucide-react';
import NewDocumentLink from '../new-document-link';
import {
  getReferenceSourceKind,
  ReferenceSourceIcon,
} from '../reference-source-icon';

const isKnowledgeGraphReference = (item: Docagg) =>
  item.source_type === 'knowledge_graph' || item.doc_id?.startsWith('kg-');

const getKnowledgeGraphId = (item: Docagg) => item.doc_id?.replace(/^kg-/, '');

const openKnowledgeGraph = (item: Docagg) => {
  const graphId = getKnowledgeGraphId(item);
  if (graphId) {
    window.open(`/knowledge-graph/${graphId}`, '_blank');
  }
};

const getDocumentSourceType = (
  item: Docagg,
  chunks?: IReferenceChunk[] | Record<string, IReferenceChunk>,
) => {
  if (item.source_type) {
    return item.source_type;
  }

  const chunkList = Array.isArray(chunks)
    ? chunks
    : Object.values(chunks ?? {});
  return chunkList.find((chunk) => {
    const chunkDocumentId = chunk?.doc_id || chunk?.document_id;
    return chunkDocumentId === item.doc_id && chunk?.source_type;
  })?.source_type;
};

export function ReferenceDocumentList({
  list,
  chunks,
}: {
  list: Docagg[];
  chunks?: IReferenceChunk[] | Record<string, IReferenceChunk>;
}) {
  return (
    <section className="flex gap-3 flex-wrap">
      {list.map((item) => {
        const itemWithSource = {
          ...item,
          source_type: getDocumentSourceType(item, chunks),
        };
        const isKgReference = isKnowledgeGraphReference(itemWithSource);
        const sourceKind = getReferenceSourceKind(undefined, itemWithSource);
        const isWebReference = sourceKind === 'web';
        return (
          <Card key={item.doc_id}>
            <CardContent className="p-2">
              {isKgReference ? (
                <div
                  className="flex items-start gap-2 max-w-80 cursor-pointer"
                  role="button"
                  tabIndex={0}
                  title="Open knowledge graph"
                  onClick={() => openKnowledgeGraph(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      openKnowledgeGraph(item);
                    }
                  }}
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                    <Network size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-text-sub-title-invert">
                      {item.doc_name}
                    </div>
                    <div className="text-xs text-text-secondary">
                      {`${item.node_num ?? 0} 个节点 · ${item.edge_num ?? 0} 条关系`}
                    </div>
                    {item.description && (
                      <div className="line-clamp-2 text-xs text-text-secondary">
                        {item.description}
                      </div>
                    )}
                  </div>
                </div>
              ) : isWebReference ? (
                <div className="flex items-start gap-2 max-w-80">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-50">
                    <ReferenceSourceIcon source="web" size={16} />
                  </div>
                  <div className="min-w-0">
                    <NewDocumentLink
                      documentId={item.doc_id}
                      documentName={item.doc_name}
                      prefix="document"
                      link={item.url}
                      className="block truncate text-text-sub-title-invert"
                    >
                      {item.doc_name}
                    </NewDocumentLink>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 max-w-80">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100">
                    <ReferenceSourceIcon source="document" size={16} />
                  </div>
                  <div className="min-w-0">
                    <NewDocumentLink
                      documentId={item.doc_id}
                      documentName={item.doc_name}
                      prefix="document"
                      link={item.url}
                      className="block truncate text-text-sub-title-invert"
                    >
                      {item.doc_name}
                    </NewDocumentLink>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
