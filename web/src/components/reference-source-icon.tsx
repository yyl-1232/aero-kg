import { Docagg, IReferenceChunk } from '@/interfaces/database/chat';
import { FileText, Globe2, Link2, Network } from 'lucide-react';
import type { CSSProperties } from 'react';

export type ReferenceSourceKind =
  | 'knowledge_graph'
  | 'web'
  | 'document'
  | 'unknown';

const webSourceTypes = new Set(['web', 'web_knowledge', 'internet', 'search']);

export const getReferenceSourceKind = (
  chunk?: IReferenceChunk,
  document?: Partial<Docagg>,
): ReferenceSourceKind => {
  if (!chunk && !document) {
    return 'unknown';
  }

  const sourceType = chunk?.source_type || document?.source_type || '';
  const documentId = chunk?.document_id || document?.doc_id || '';

  if (sourceType === 'knowledge_graph' || documentId.startsWith('kg-')) {
    return 'knowledge_graph';
  }

  if (webSourceTypes.has(sourceType)) {
    return 'web';
  }

  return 'document';
};

const iconConfig = {
  knowledge_graph: {
    Icon: Network,
    color: '#1677ff',
    label: 'Knowledge graph reference',
  },
  web: {
    Icon: Globe2,
    color: '#059669',
    label: 'Web search reference',
  },
  document: {
    Icon: FileText,
    color: '#475569',
    label: 'Document reference',
  },
  unknown: {
    Icon: Link2,
    color: '#64748b',
    label: 'Reference',
  },
};

export function ReferenceSourceIcon({
  chunk,
  document,
  source,
  size = 15,
  className,
  style,
}: {
  chunk?: IReferenceChunk;
  document?: Partial<Docagg>;
  source?: ReferenceSourceKind;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const kind = source ?? getReferenceSourceKind(chunk, document);
  const { Icon, color, label } = iconConfig[kind];

  return (
    <Icon
      aria-label={label}
      className={className}
      size={size}
      style={{ color, ...style }}
    />
  );
}
