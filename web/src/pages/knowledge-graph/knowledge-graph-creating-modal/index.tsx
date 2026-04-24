import { IModalManagerChildrenProps } from '@/components/modal-manager';
import { ButtonLoading } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

const FormId = 'knowledge-graph-creating-form';

type FormValues = {
  name: string;
};

interface IProps extends Omit<IModalManagerChildrenProps, 'showModal'> {
  loading: boolean;
  onOk: (name: string) => void;
}

const KnowledgeGraphCreatingModal = ({
  visible,
  hideModal,
  loading,
  onOk,
}: IProps) => {
  const { t } = useTranslation('translation', {
    keyPrefix: 'knowledgeGraphList',
  });

  const FormSchema = z.object({
    name: z
      .string()
      .min(1, {
        message: t('namePlaceholder'),
      })
      .trim(),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: '',
    },
  });

  useEffect(() => {
    if (!visible) {
      form.reset();
    }
  }, [form, visible]);

  const handleSubmit = (values: FormValues) => {
    onOk(values.name);
  };

  return (
    <Dialog
      open={visible}
      onOpenChange={(open) => {
        if (!open) {
          hideModal();
          form.reset();
        }
      }}
    >
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('createKnowledgeGraph')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
            id={FormId}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('name')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('namePlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter>
          <ButtonLoading type="submit" form={FormId} loading={loading}>
            {t('createKnowledgeGraph')}
          </ButtonLoading>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default KnowledgeGraphCreatingModal;
