import { Button, ButtonLoading } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { DatasetMetadata } from '@/constants/chat';
import { useFetchDialog, useSetDialog } from '@/hooks/use-chat-request';
import { cn } from '@/lib/utils';
import { transformBase64ToFile, transformFile2Base64 } from '@/utils/file-util';
import {
  removeUselessFieldsFromValues,
  setLLMSettingEnabledValues,
} from '@/utils/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { omit } from 'lodash';
import { X } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams } from 'umi';
import { z } from 'zod';
import { chatSettingsSavedStorageKeyPrefix } from '../chat-settings-storage';
import ChatBasicSetting from './chat-basic-settings';
import { ChatModelSettings } from './chat-model-settings';
import { ChatPromptEngine } from './chat-prompt-engine';
import { useChatSettingSchema } from './use-chat-setting-schema';

type ChatSettingsProps = { switchSettingVisible(): void; visible: boolean };
export function ChatSettings({
  switchSettingVisible,
  visible,
}: ChatSettingsProps) {
  const formSchema = useChatSettingSchema();
  const { data } = useFetchDialog();
  const { setDialog, loading } = useSetDialog();
  const { id } = useParams();
  const { t } = useTranslation();

  type FormSchemaType = z.infer<typeof formSchema>;

  const defaultPromptConfig = useMemo<FormSchemaType['prompt_config']>(
    () => ({
      quote: true,
      keyword: false,
      tts: false,
      use_kg: false,
      kg_ids: [],
      kg_similarity_threshold: 0.3,
      kg_mining_depth: 2,
      refine_multiturn: true,
      system: '',
      parameters: [],
      tavily_enabled: false,
    }),
    [],
  );

  const defaultValues = useMemo<FormSchemaType>(
    () =>
      ({
        name: '',
        icon: [],
        language: 'Chinese',
        description: '',
        kb_ids: [],
        prompt_config: {
          ...defaultPromptConfig,
        },
        top_n: 8,
        vector_similarity_weight: 0.2,
        top_k: 1024,
        meta_data_filter: {
          method: DatasetMetadata.Disabled,
          manual: [],
        },
      }) as FormSchemaType,
    [defaultPromptConfig],
  );

  const form = useForm<FormSchemaType>({
    resolver: zodResolver(formSchema),
    shouldUnregister: false,
    defaultValues,
  });

  async function onSubmit(values: FormSchemaType) {
    const nextValues: Record<string, any> = removeUselessFieldsFromValues(
      values,
      'llm_setting.',
    );
    const icon = nextValues.icon;
    const avatar =
      Array.isArray(icon) && icon.length > 0
        ? await transformFile2Base64(icon[0])
        : '';
    const code = await setDialog({
      ...omit(data, 'operator_permission'),
      ...nextValues,
      icon: avatar,
      dialog_id: id,
    });

    if (code === 0 && id) {
      try {
        window.localStorage.setItem(
          `${chatSettingsSavedStorageKeyPrefix}${id}`,
          '1',
        );
      } catch {}
    }
  }

  function onInvalid(errors: any) {
    console.log('Form validation failed:', errors);
    console.log('Detailed errors:', JSON.stringify(errors, null, 2));

    // 检查 prompt_config 的具体错误
    if (errors.prompt_config) {
      console.log('Prompt config errors:', errors.prompt_config);
    }
  }

  useEffect(() => {
    const llmSettingEnabledValues = setLLMSettingEnabledValues(
      data.llm_setting,
    );

    const nextData = {
      ...defaultValues,
      ...data,
      icon: data.icon ? [transformBase64ToFile(data.icon)] : [],
      kb_ids: data.kb_ids ?? defaultValues.kb_ids,
      prompt_config: {
        ...defaultPromptConfig,
        ...data.prompt_config,
        parameters:
          data.prompt_config?.parameters ?? defaultPromptConfig.parameters,
        kg_ids: data.prompt_config?.kg_ids ?? defaultPromptConfig.kg_ids,
        kg_similarity_threshold:
          data.prompt_config?.kg_similarity_threshold ??
          defaultPromptConfig.kg_similarity_threshold,
        kg_mining_depth:
          data.prompt_config?.kg_mining_depth ??
          defaultPromptConfig.kg_mining_depth,
        tavily_enabled:
          data.prompt_config?.tavily_enabled ??
          Boolean(data.prompt_config?.tavily_api_key),
      },
      meta_data_filter: {
        ...defaultValues.meta_data_filter,
        ...data.meta_data_filter,
        manual:
          data.meta_data_filter?.manual ??
          defaultValues.meta_data_filter.manual,
      },
      ...llmSettingEnabledValues,
    };
    form.reset(nextData as FormSchemaType);
  }, [data, defaultPromptConfig, defaultValues, form]);

  return (
    <section
      className={cn('p-5 w-[440px] border-l flex flex-col', {
        hidden: !visible,
      })}
    >
      <div className="flex justify-between items-center text-base pb-2">
        {t('chat.chatSetting')}
        <X className="size-4 cursor-pointer" onClick={switchSettingVisible} />
      </div>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit, onInvalid)}
          className="flex-1 flex flex-col min-h-0"
        >
          <section className="space-y-6 overflow-auto flex-1 pr-4 min-h-0">
            <ChatBasicSetting></ChatBasicSetting>
            <Separator />
            <ChatPromptEngine></ChatPromptEngine>
            <Separator />
            <ChatModelSettings></ChatModelSettings>
          </section>
          <div className="space-x-5 text-right pt-4">
            <Button
              type="button"
              variant={'outline'}
              onClick={switchSettingVisible}
            >
              {t('chat.cancel')}
            </Button>
            <ButtonLoading type="submit" loading={loading}>
              {t('common.save')}
            </ButtonLoading>
          </div>
        </form>
      </Form>
    </section>
  );
}
