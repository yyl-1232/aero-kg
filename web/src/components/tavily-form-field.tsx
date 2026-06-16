import { useTranslate } from '@/hooks/common-hooks';
import { useEffect } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import PasswordInput from './originui/password-input';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './ui/form';
import { Switch } from './ui/switch';

interface IProps {
  name?: string;
}

const getEnabledName = (name: string) =>
  name.replace(/(^|\.|_)tavily_api_key$/, '$1tavily_enabled');

export function TavilyFormField({
  name = 'prompt_config.tavily_api_key',
}: IProps) {
  const form = useFormContext();
  const { t } = useTranslate('chat');
  const enabledName = getEnabledName(name);
  const apiKey = useWatch({ control: form.control, name });
  const enabled = useWatch({ control: form.control, name: enabledName });
  const isEnabled = enabled ?? Boolean(apiKey);

  useEffect(() => {
    if (enabled === undefined && apiKey) {
      form.setValue(enabledName, true, { shouldDirty: false });
    }
  }, [apiKey, enabled, enabledName, form]);

  return (
    <FormItem>
      <div className="flex items-center justify-between gap-3">
        <FormLabel tooltip={t('tavilyApiKeyTip')}>
          {t('enableWebSearch')}
        </FormLabel>
        <FormField
          control={form.control}
          name={enabledName}
          render={({ field }) => (
            <FormControl>
              <Switch
                checked={isEnabled}
                onCheckedChange={field.onChange}
                className="!m-0"
              />
            </FormControl>
          )}
        />
      </div>
      <FormField
        control={form.control}
        name={name}
        render={({ field }) => (
          <>
            <FormControl>
              <PasswordInput
                {...field}
                placeholder={t('tavilyApiKeyMessage')}
                autoComplete="new-password"
                disabled={!isEnabled}
              ></PasswordInput>
            </FormControl>
            <FormDescription>
              <a
                href="https://app.tavily.com/home"
                target={'_blank'}
                rel="noreferrer"
              >
                {t('tavilyApiKeyHelp')}
              </a>
            </FormDescription>
            <FormMessage />
          </>
        )}
      />
    </FormItem>
  );
}
