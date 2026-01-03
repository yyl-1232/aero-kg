'use client';

import { RerankFormFields } from '@/components/rerank';
import { SimilaritySliderFormField } from '@/components/similarity-slider';
import { SwitchFormField } from '@/components/switch-fom-field';
import { TopNFormField } from '@/components/top-n-item';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useTranslate } from '@/hooks/common-hooks';
import { useFormContext } from 'react-hook-form';
import { DynamicVariableForm } from './dynamic-variable';
import { KgSelector } from './kg-selector';

export function ChatPromptEngine() {
  const { t } = useTranslate('chat');
  const form = useFormContext();
  const { watch } = useFormContext();
  return (
    <div className="space-y-8">
      <FormField
        control={form.control}
        name="prompt_config.system"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('system')}</FormLabel>
            <FormControl>
              <Textarea {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <SimilaritySliderFormField></SimilaritySliderFormField>
      <TopNFormField></TopNFormField>
      <SwitchFormField
        name={'prompt_config.refine_multiturn'}
        label={t('multiTurn')}
      ></SwitchFormField>

      <SwitchFormField
        name={'prompt_config.use_kg'}
        label={t('useKnowledgeGraph')}
      ></SwitchFormField>

      {watch('prompt_config.use_kg') && <KgSelector></KgSelector>}

      <RerankFormFields></RerankFormFields>
      <DynamicVariableForm></DynamicVariableForm>
    </div>
  );
}
