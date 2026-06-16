import Image from '@/components/image';
import { KnowledgeGraphReferencePreview } from '@/components/knowledge-graph-reference-preview';
import {
  getReferenceSourceKind,
  ReferenceSourceIcon,
} from '@/components/reference-source-icon';
import SvgIcon from '@/components/svg-icon';
import { IReferenceChunk, IReferenceObject } from '@/interfaces/database/chat';
import { getExtension } from '@/utils/document-util';
import DOMPurify from 'dompurify';
import { memo, useCallback, useEffect, useMemo } from 'react';
import Markdown from 'react-markdown';
import reactStringReplace from 'react-string-replace';
import SyntaxHighlighter from 'react-syntax-highlighter';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { visitParents } from 'unist-util-visit-parents';

import { useFetchDocumentThumbnailsByIds } from '@/hooks/document-hooks';
import { useTranslation } from 'react-i18next';

import 'katex/dist/katex.min.css'; // `rehype-katex` does not import the CSS for you

import {
  preprocessLaTeX,
  replaceThinkToSection,
  showImage,
} from '@/utils/chat';

import { cn } from '@/lib/utils';
import { currentReg, replaceTextByOldReg } from '@/pages/chat/utils';
import classNames from 'classnames';
import { omit } from 'lodash';
import { pipe } from 'lodash/fp';
import { Network } from 'lucide-react';
import { Button } from '../ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '../ui/hover-card';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import styles from './index.less';

const getChunkIndex = (match: string) => Number(match);

const isKnowledgeGraphReference = (chunk?: IReferenceChunk) =>
  chunk?.source_type === 'knowledge_graph' ||
  chunk?.document_id?.startsWith('kg-');

const formatKgSummary = (chunk?: IReferenceChunk) => {
  const nodeCount = chunk?.kg_node_num ?? 0;
  const edgeCount = chunk?.kg_edge_num ?? 0;
  return `${nodeCount} 个节点 · ${edgeCount} 条关系`;
};

const formatKgEntitySource = (chunk?: IReferenceChunk) => {
  const entityName =
    chunk?.kg_entity_name ||
    chunk?.document_name?.replace(/^Knowledge Graph\s*-\s*/i, '');
  const entityType = chunk?.kg_entity_type;
  return entityType ? `${entityName} (${entityType})` : entityName;
};

const isPlaceholderKgName = (name?: string) =>
  !name ||
  ['Unknown', 'Knowledge Graph', 'knowledge_graph'].includes(name.trim());

const getKgGraphName = (chunk?: IReferenceChunk, documentName?: string) => {
  const candidates = [
    chunk?.kg_name,
    documentName,
    chunk?.kg_entity_name,
    chunk?.document_name?.replace(/^Knowledge Graph\s*-\s*/i, ''),
  ];
  return (
    candidates.find((item) => item && !isPlaceholderKgName(item)) ||
    candidates.find(Boolean) ||
    'Knowledge Graph'
  );
};

const getKgGraphId = (chunk?: IReferenceChunk) =>
  chunk?.kg_id || chunk?.document_id?.replace(/^kg-/, '');

const openKnowledgeGraph = (graphId?: string) => {
  if (graphId) {
    window.open(`/knowledge-graph/${graphId}`, '_blank');
  }
};

// TODO: The display of the table is inconsistent with the display previously placed in the MessageItem.
function MarkdownContent({
  reference,
  clickDocumentButton,
  content,
}: {
  content: string;
  loading: boolean;
  reference?: IReferenceObject;
  clickDocumentButton?: (documentId: string, chunk: IReferenceChunk) => void;
}) {
  const { t } = useTranslation();
  const { setDocumentIds, data: fileThumbnails } =
    useFetchDocumentThumbnailsByIds();
  const contentWithCursor = useMemo(() => {
    // let text = DOMPurify.sanitize(content);
    let text = content;
    if (text === '') {
      text = t('chat.searching');
    }
    const nextText = replaceTextByOldReg(text);
    return pipe(replaceThinkToSection, preprocessLaTeX)(nextText);
  }, [content, t]);

  useEffect(() => {
    const docAggs = reference?.doc_aggs;
    setDocumentIds(Array.isArray(docAggs) ? docAggs.map((x) => x.doc_id) : []);
  }, [reference, setDocumentIds]);

  const handleDocumentButtonClick = useCallback(
    (
      documentId: string,
      chunk: IReferenceChunk,
      isPdf: boolean,
      documentUrl?: string,
    ) =>
      () => {
        if (!isPdf) {
          if (!documentUrl) {
            return;
          }
          window.open(documentUrl, '_blank');
        } else {
          clickDocumentButton?.(documentId, chunk);
        }
      },
    [clickDocumentButton],
  );

  const rehypeWrapReference = () => {
    return function wrapTextTransform(tree: any) {
      visitParents(tree, 'text', (node, ancestors) => {
        const latestAncestor = ancestors.at(-1);
        if (
          latestAncestor.tagName !== 'custom-typography' &&
          latestAncestor.tagName !== 'code'
        ) {
          node.type = 'element';
          node.tagName = 'custom-typography';
          node.properties = {};
          node.children = [{ type: 'text', value: node.value }];
        }
      });
    };
  };

  const getReferenceInfo = useCallback(
    (chunkIndex: number) => {
      const chunks = reference?.chunks ?? {};
      const chunkItem = chunks[chunkIndex];

      const documentList = Object.values(reference?.doc_aggs ?? {});
      const document = documentList.find(
        (x) => x?.doc_id === chunkItem?.document_id,
      );
      const documentId = document?.doc_id;
      const documentUrl = document?.url;
      const fileThumbnail = documentId ? fileThumbnails[documentId] : '';
      const fileExtension = documentId ? getExtension(document?.doc_name) : '';
      const imageId = chunkItem?.image_id;

      return {
        documentUrl,
        fileThumbnail,
        fileExtension,
        imageId,
        chunkItem,
        documentId,
        document,
      };
    },
    [fileThumbnails, reference],
  );

  const renderPopoverContent = useCallback(
    (chunkIndex: number) => {
      const {
        documentUrl,
        fileThumbnail,
        fileExtension,
        imageId,
        chunkItem,
        documentId,
        document,
      } = getReferenceInfo(chunkIndex);

      return (
        <div key={chunkItem?.id} className="flex gap-2">
          {imageId && (
            <HoverCard>
              <HoverCardTrigger>
                <Image
                  id={imageId}
                  className={styles.referenceChunkImage}
                ></Image>
              </HoverCardTrigger>
              <HoverCardContent>
                <Image
                  id={imageId}
                  className={cn(styles.referenceImagePreview)}
                ></Image>
              </HoverCardContent>
            </HoverCard>
          )}
          <div className={'space-y-2 max-w-[40vw] w-full'}>
            {isKnowledgeGraphReference(chunkItem) ? (
              <KnowledgeGraphReferencePreview content={chunkItem?.content} />
            ) : (
              <div
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(chunkItem?.content ?? ''),
                }}
                className={classNames(styles.chunkContentText, 'w-full')}
              ></div>
            )}
            {isKnowledgeGraphReference(chunkItem) && (
              <div
                className={styles.kgReferenceSummary}
                role="button"
                tabIndex={0}
                title="Open knowledge graph"
                onClick={() => openKnowledgeGraph(getKgGraphId(chunkItem))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    openKnowledgeGraph(getKgGraphId(chunkItem));
                  }
                }}
              >
                <div className={styles.kgReferenceSourceLabel}>来源</div>
                <div className={styles.kgReferenceTitle}>
                  <Network size={16} />
                  <span>命中实体：{formatKgEntitySource(chunkItem)}</span>
                </div>
                {chunkItem?.kg_entity_description && (
                  <div className={styles.kgReferenceDescription}>
                    {chunkItem.kg_entity_description}
                  </div>
                )}
                <div className={styles.kgReferenceMeta}>
                  来源图谱：{getKgGraphName(chunkItem, document?.doc_name)} ·{' '}
                  {formatKgSummary(chunkItem)}
                </div>
              </div>
            )}
            {documentId && !isKnowledgeGraphReference(chunkItem) && (
              <div className="flex gap-1">
                {fileThumbnail ? (
                  <img
                    src={fileThumbnail}
                    alt=""
                    className={styles.fileThumbnail}
                  />
                ) : (
                  <SvgIcon
                    name={`file-icon/${fileExtension}`}
                    width={24}
                  ></SvgIcon>
                )}
                <Button
                  variant="link"
                  onClick={handleDocumentButtonClick(
                    documentId,
                    chunkItem,
                    fileExtension === 'pdf',
                    documentUrl,
                  )}
                  className="text-ellipsis text-wrap"
                >
                  {document?.doc_name}
                </Button>
              </div>
            )}
          </div>
        </div>
      );
    },
    [getReferenceInfo, handleDocumentButtonClick],
  );

  const renderReference = useCallback(
    (text: string) => {
      let replacedText = reactStringReplace(text, currentReg, (match, i) => {
        const chunkIndex = getChunkIndex(match);

        const {
          documentUrl,
          fileExtension,
          imageId,
          chunkItem,
          documentId,
          document,
        } = getReferenceInfo(chunkIndex);

        const docType = chunkItem?.doc_type;

        return showImage(docType) ? (
          <Image
            id={imageId}
            className={styles.referenceInnerChunkImage}
            onClick={
              documentId
                ? handleDocumentButtonClick(
                    documentId,
                    chunkItem,
                    fileExtension === 'pdf',
                    documentUrl,
                  )
                : () => {}
            }
          ></Image>
        ) : getReferenceSourceKind(chunkItem, document) ===
          'knowledge_graph' ? (
          <Popover key={i}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={styles.referenceSourceButton}
                onClick={(event) => event.stopPropagation()}
              >
                <ReferenceSourceIcon
                  chunk={chunkItem}
                  document={document}
                  className={styles.referenceSourceIcon}
                />
              </button>
            </PopoverTrigger>
            <PopoverContent className="!w-fit">
              {renderPopoverContent(chunkIndex)}
            </PopoverContent>
          </Popover>
        ) : (
          <Popover key={i}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={styles.referenceSourceButton}
                onClick={(event) => event.stopPropagation()}
              >
                <ReferenceSourceIcon
                  chunk={chunkItem}
                  document={document}
                  className={styles.referenceSourceIcon}
                />
              </button>
            </PopoverTrigger>
            <PopoverContent className="!w-fit">
              {renderPopoverContent(chunkIndex)}
            </PopoverContent>
          </Popover>
        );
      });

      return replacedText;
    },
    [renderPopoverContent, getReferenceInfo, handleDocumentButtonClick],
  );

  return (
    <Markdown
      rehypePlugins={[rehypeWrapReference, rehypeKatex, rehypeRaw]}
      remarkPlugins={[remarkGfm, remarkMath]}
      className={styles.markdownContentWrapper}
      components={
        {
          'custom-typography': ({ children }: { children: string }) =>
            renderReference(children),
          code(props: any) {
            const { children, className, ...rest } = props;
            const restProps = omit(rest, 'node');
            const match = /language-(\w+)/.exec(className || '');
            return match ? (
              <SyntaxHighlighter
                {...restProps}
                PreTag="div"
                language={match[1]}
                wrapLongLines
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code
                {...restProps}
                className={classNames(className, 'text-wrap')}
              >
                {children}
              </code>
            );
          },
        } as any
      }
    >
      {contentWithCursor}
    </Markdown>
  );
}

export default memo(MarkdownContent);
