import { Form, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { SwitchFormField } from './switch-fom-field';

type IProps = {
  filedName: string[] | string;
};

export function UseKnowledgeGraphItem({ filedName }: IProps) {
  const { t } = useTranslation();

  return (
    <div style={{ border: '1px solid red', padding: '10px', margin: '10px 0' }}>
      <div>调试：UseKnowledgeGraphItem 组件已渲染</div>
      <Form.Item
        label={t('chat.useKnowledgeGraph')}
        tooltip={t('chat.useKnowledgeGraphTip')}
        name={filedName}
        initialValue={false}
        valuePropName="checked"
      >
        <Switch></Switch>
      </Form.Item>
    </div>
  );
}

interface UseKnowledgeGraphFormFieldProps {
  name: string;
}

export function UseKnowledgeGraphFormField({
  name,
}: UseKnowledgeGraphFormFieldProps) {
  const { t } = useTranslation();

  return (
    <SwitchFormField
      name={name}
      label={t('chat.useKnowledgeGraph')}
      tooltip={t('chat.useKnowledgeGraphTip')}
    ></SwitchFormField>
  );
}
