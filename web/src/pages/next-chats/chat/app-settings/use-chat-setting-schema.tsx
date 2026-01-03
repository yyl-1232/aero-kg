import {
  LlmSettingEnabledSchema,
  LlmSettingFieldSchema,
} from '@/components/llm-setting-items/next';
import { MetadataFilterSchema } from '@/components/metadata-filter';
import { rerankFormSchema } from '@/components/rerank';
import { vectorSimilarityWeightSchema } from '@/components/similarity-slider';
import { topnSchema } from '@/components/top-n-item';
import { useTranslate } from '@/hooks/common-hooks';
import { z } from 'zod';

export function useChatSettingSchema() {
  const { t } = useTranslate('chat');

  const promptConfigSchema = z.object({
    quote: z.boolean(),
    keyword: z.boolean(),
    tts: z.boolean(),
    empty_response: z.string().optional(),
    prologue: z.string().optional(),
    system: z.string().min(1, { message: t('systemMessage') }),
    refine_multiturn: z.boolean(),
    use_kg: z.boolean(),
    kg_ids: z.array(z.string()).optional(), // 知识图谱ID数组
    kg_similarity_threshold: z.number().min(0).max(1).optional(), // 相似度阈值
    kg_mining_depth: z.number().min(1).max(10).optional(), // 挖掘深度
    parameters: z.array(
      z.object({
        key: z.string(),
        optional: z.boolean(),
      }),
    ),
    tavily_api_key: z.string().optional(),
  });

  const formSchema = z.object({
    name: z.string().min(1, { message: t('assistantNameMessage') }),
    icon: z.array(z.instanceof(File)),
    language: z.string().min(1, {
      message: t('languageMessage'),
    }),
    description: z.string().optional(),
    kb_ids: z.array(z.string()).min(0, {
      message: t('knowledgeBasesMessage'),
    }),
    prompt_config: promptConfigSchema,
    ...rerankFormSchema,
    llm_setting: z.object(LlmSettingFieldSchema),
    ...LlmSettingEnabledSchema,
    llm_id: z.string().optional(),
    ...vectorSimilarityWeightSchema,
    ...topnSchema,
    ...MetadataFilterSchema,
  });

  return formSchema;
}
