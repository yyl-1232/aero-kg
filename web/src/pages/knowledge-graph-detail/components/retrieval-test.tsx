import { FormContainer } from '@/components/form-container';
import { Button } from '@/components/ui/button';
import { SingleFormSlider } from '@/components/ui/dual-range-slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useKnowledgeBaseId } from '@/hooks/knowledge-hooks';
import { getAuthorization } from '@/utils/authorization-util';
import { Info } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface RetrievalTestProps {
  knowledgeGraphId: string;
}

function Tip({ content }: { content: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center"
            aria-label="info"
          >
            <Info className="h-4 w-4 text-text-sub-title" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function RetrievalTest({
  knowledgeGraphId,
}: RetrievalTestProps) {
  const { t } = useTranslation();
  const kbId = useKnowledgeBaseId();
  const [question, setQuestion] = useState('');
  const [similarityThreshold, setSimilarityThreshold] = useState(0.3);
  const [subgraphDepth, setSubgraphDepth] = useState(2);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const handleTest = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/v1/kb/${kbId}/knowledge_graph/retrieval_test`,
        {
          method: 'POST',
          headers: {
            Authorization: getAuthorization(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            kb_id: knowledgeGraphId,
            question,
            similarity_threshold: similarityThreshold,
            subgraph_depth: subgraphDepth,
            mode: 'text_match',
          }),
        },
      );
      const data = await response.json();
      setResults(data.data);
    } catch (error) {
      console.error('检索测试失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="flex divide-x h-full">
      {/* 左侧 */}
      <div className="p-4 flex-1">
        <div className="flex flex-col gap-4">
          {/* 标题 */}
          <div className="flex justify-between pb-2.5">
            <div>
              <span className="text-text-primary font-semibold text-xl">
                {t('knowledgeDetails.testSetting')}
              </span>
              <div className="text-xs text-text-sub-title mt-1">
                基于分词和字符级匹配的知识图谱检索测试，验证实体和关系的召回能力
              </div>
            </div>
          </div>

          {/* ✅ 测试设置（仅参数，不放按钮） */}
          <FormContainer>
            <div className="space-y-6">
              {/* 相似度阈值 */}
              <div>
                <div className="flex items-center gap-2">
                  <Label>相似度阈值</Label>
                  <Tip content="仅召回相似度高于此阈值的实体和关系，阈值越高召回结果越精确但数量越少" />
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <SingleFormSlider
                    value={similarityThreshold}
                    onChange={setSimilarityThreshold}
                    max={1.0}
                    min={0.0}
                    step={0.1}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={similarityThreshold}
                    onChange={(e) =>
                      setSimilarityThreshold(parseFloat(e.target.value || '0'))
                    }
                    className="w-16 h-8 text-center"
                    max={1.0}
                    min={0.0}
                    step={0.1}
                  />
                </div>
              </div>

              {/* 子图深度 */}
              <div>
                <div className="flex items-center gap-2">
                  <Label>挖掘深度</Label>
                  <Tip content="控制关联实体跳转的深度，深度越大检索范围越广但可能包含更多无关信息" />
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <SingleFormSlider
                    value={subgraphDepth}
                    onChange={setSubgraphDepth}
                    max={5}
                    min={1}
                    step={1}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={subgraphDepth}
                    onChange={(e) =>
                      setSubgraphDepth(parseInt(e.target.value || '1', 10))
                    }
                    className="w-16 h-8 text-center"
                    max={5}
                    min={1}
                    step={1}
                  />
                </div>
              </div>
            </div>
          </FormContainer>

          {/* ✅ 测试问题 + 按钮：按钮放在问题下面 */}
          <FormContainer>
            <div>
              <div className="flex items-center gap-2">
                <Label htmlFor="question">测试问题</Label>
                <Tip content="输入您想要测试的问题，系统将基于分词和字符级匹配从知识图谱中检索相关实体和关系" />
              </div>

              <Input
                id="question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="请输入测试问题..."
                className="mt-2"
              />

              <Button
                onClick={handleTest}
                disabled={loading || !question}
                className="w-full mt-4 bg-green-500 text-blue-600 hover:bg-green-600 hover:text-blue-700 disabled:text-blue-300"
              >
                {loading ? '检索中...' : '开始检索'}
              </Button>
            </div>
          </FormContainer>
        </div>
      </div>

      {/* 右侧结果展示 */}
      <div className="p-4 flex-1">
        <div className="flex justify-between pb-2.5">
          <span className="text-text-primary font-semibold text-xl">
            {t('knowledgeDetails.testResults')}
          </span>
        </div>

        <div className="flex flex-col gap-5 overflow-auto h-[76vh] mb-5">
          {results ? (
            <>
              {results.entities?.length > 0 && (
                <FormContainer className="px-5 py-2.5">
                  <h3 className="font-semibold mb-3 text-text-primary">
                    匹配实体
                  </h3>
                  <div className="space-y-2">
                    {results.entities.map((entity: any, index: number) => (
                      <div
                        key={index}
                        className="flex justify-between items-center p-2 bg-gray-50 rounded"
                      >
                        <span className="font-medium">
                          {entity.entity_name}
                        </span>
                        <span className="text-sm text-text-sub-title">
                          相似度: {(entity.similarity * 100).toFixed(2)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </FormContainer>
              )}

              {results.relationships?.length > 0 && (
                <FormContainer className="px-5 py-2.5">
                  <h3 className="font-semibold mb-3 text-text-primary">
                    匹配关系
                  </h3>
                  <div className="space-y-2">
                    {results.relationships.map((rel: any, index: number) => (
                      <div key={index} className="p-2 bg-blue-50 rounded">
                        <span className="font-medium">{rel.source}</span>
                        <span className="mx-2 text-text-sub-title">→</span>
                        <span className="font-medium">{rel.target}</span>
                        <span className="ml-2 text-sm text-text-sub-title">
                          ({rel.description})
                        </span>
                      </div>
                    ))}
                  </div>
                </FormContainer>
              )}

              {results.description && (
                <FormContainer className="px-5 py-2.5">
                  <h3 className="font-semibold mb-3 text-text-primary">
                    自然语言描述
                  </h3>
                  <div className="bg-blue-50 p-4 rounded">
                    <p className="text-sm leading-relaxed">
                      {results.description}
                    </p>
                  </div>
                </FormContainer>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-text-sub-title">
              请设置参数并点击&quot;开始检索&quot;查看结果
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
