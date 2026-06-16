import { useTranslate } from '@/hooks/common-hooks';
import { Form, Input, Switch, Typography } from 'antd';
import { useEffect, useMemo } from 'react';

interface IProps {
  name?: string | string[];
}

const DEFAULT_TAVILY_API_KEY_NAME = ['prompt_config', 'tavily_api_key'];

const getEnabledName = (name: string | string[]) => {
  const path = Array.isArray(name) ? name : [name];
  return [...path.slice(0, -1), 'tavily_enabled'];
};

export function TavilyItem({ name = DEFAULT_TAVILY_API_KEY_NAME }: IProps) {
  const { t } = useTranslate('chat');
  const form = Form.useFormInstance();
  const enabledName = useMemo(() => getEnabledName(name), [name]);
  const apiKey = Form.useWatch(name, form);
  const enabled = Form.useWatch(enabledName, form);
  const isEnabled = enabled ?? Boolean(apiKey);

  useEffect(() => {
    if (enabled === undefined && apiKey) {
      form.setFieldValue(enabledName, true);
    }
  }, [apiKey, enabled, enabledName, form]);

  return (
    <Form.Item label={'Tavily API Key'} tooltip={t('tavilyApiKeyTip')}>
      <div className="flex flex-col gap-1">
        <div className="mb-1 flex items-center justify-between gap-2">
          <Typography.Text>{t('enableWebSearch')}</Typography.Text>
          <Form.Item name={enabledName} valuePropName="checked" noStyle>
            <Switch size="small" checked={isEnabled} />
          </Form.Item>
        </div>
        <Form.Item name={name} noStyle>
          <Input.Password
            placeholder={t('tavilyApiKeyMessage')}
            autoComplete="new-password"
            disabled={!isEnabled}
          />
        </Form.Item>
        <Typography.Link href="https://app.tavily.com/home" target={'_blank'}>
          {t('tavilyApiKeyHelp')}
        </Typography.Link>
      </div>
    </Form.Item>
  );
}
