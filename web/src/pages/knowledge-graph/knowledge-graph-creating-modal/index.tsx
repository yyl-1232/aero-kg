import { IModalManagerChildrenProps } from '@/components/modal-manager';
import { Form, Input, Modal } from 'antd';
import { useTranslation } from 'react-i18next';

type FieldType = {
  name?: string;
  description?: string;
};

interface IProps extends Omit<IModalManagerChildrenProps, 'showModal'> {
  loading: boolean;
  onOk: (name: string, description: string) => void;
}

const KnowledgeGraphCreatingModal = ({
  visible,
  hideModal,
  loading,
  onOk,
}: IProps) => {
  const [form] = Form.useForm();

  const { t } = useTranslation('translation', {
    keyPrefix: 'knowledgeGraphList',
  });

  const handleOk = async () => {
    const ret = await form.validateFields();
    onOk(ret.name, ret.description);
  };

  const handleKeyDown = async (e) => {
    if (e.key === 'Enter') {
      await handleOk();
    }
  };

  return (
    <Modal
      title={t('createKnowledgeGraph')}
      open={visible}
      onOk={handleOk}
      onCancel={hideModal}
      okButtonProps={{ loading }}
    >
      <Form
        name="Create"
        labelCol={{ span: 4 }}
        wrapperCol={{ span: 20 }}
        style={{ maxWidth: 600 }}
        autoComplete="off"
        form={form}
      >
        <Form.Item<FieldType>
          label={t('name')}
          name="name"
          rules={[{ required: true, message: t('namePlaceholder') }]}
        >
          <Input placeholder={t('namePlaceholder')} onKeyDown={handleKeyDown} />
        </Form.Item>
        <Form.Item<FieldType> label={t('description')} name="description">
          <Input.TextArea
            placeholder={t('descriptionPlaceholder')}
            rows={4}
            onKeyDown={handleKeyDown}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default KnowledgeGraphCreatingModal;
