import { ChatSearchParams, MessageType } from '@/constants/chat';
import { useTranslate } from '@/hooks/common-hooks';
import {
  useFetchConversationList,
  useFetchDialogList,
  useGetChatSearchParams,
} from '@/hooks/use-chat-request';
import { IConversation } from '@/interfaces/database/chat';
import { getConversationId } from '@/utils/chat';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'umi';

export const useFindPrologueFromDialogList = () => {
  const { id: dialogId } = useParams();
  const { data } = useFetchDialogList();

  const prologue = useMemo(() => {
    return data.dialogs.find((x) => x.id === dialogId)?.prompt_config.prologue;
  }, [dialogId, data]);

  return prologue;
};

export const useSetNewConversationRouteParams = () => {
  const [currentQueryParameters, setSearchParams] = useSearchParams();
  const newQueryParameters: URLSearchParams = useMemo(
    () => new URLSearchParams(currentQueryParameters.toString()),
    [currentQueryParameters],
  );

  const setNewConversationRouteParams = useCallback(
    (conversationId: string, isNew: string) => {
      newQueryParameters.set(ChatSearchParams.ConversationId, conversationId);
      newQueryParameters.set(ChatSearchParams.isNew, isNew);
      setSearchParams(newQueryParameters);
    },
    [newQueryParameters, setSearchParams],
  );

  return { setNewConversationRouteParams };
};

export const useSelectDerivedConversationList = () => {
  const { t } = useTranslate('chat');

  const [list, setList] = useState<Array<IConversation>>([]);
  const {
    data: conversationList,
    loading,
    handleInputChange,
    searchString,
  } = useFetchConversationList();
  const { id: dialogId } = useParams();
  const { setNewConversationRouteParams } = useSetNewConversationRouteParams();
  const { conversationId, isNew } = useGetChatSearchParams();
  const prologue = useFindPrologueFromDialogList();

  const buildTemporaryConversation = useCallback(
    (conversationId: string) =>
      ({
        id: conversationId,
        name: t('newConversation'),
        dialog_id: dialogId,
        is_new: true,
        message: prologue
          ? [
              {
                content: prologue,
                role: MessageType.Assistant,
              },
            ]
          : [],
      }) as IConversation,
    [dialogId, prologue, t],
  );

  const addTemporaryConversation = useCallback(() => {
    const conversationId = getConversationId();
    if (!dialogId) {
      return;
    }

    const temporaryConversation = buildTemporaryConversation(conversationId);
    setNewConversationRouteParams(conversationId, 'true');
    setList([temporaryConversation, ...conversationList]);
  }, [
    buildTemporaryConversation,
    conversationList,
    dialogId,
    setNewConversationRouteParams,
  ]);

  useEffect(() => {
    if (isNew === 'true' && conversationId) {
      const hasCurrentConversation = conversationList.some(
        (item) => item.id === conversationId,
      );

      setList(
        hasCurrentConversation
          ? [...conversationList]
          : [buildTemporaryConversation(conversationId), ...conversationList],
      );
      return;
    }

    setList([...conversationList]);
  }, [buildTemporaryConversation, conversationId, conversationList, isNew]);

  useEffect(() => {
    if (!dialogId || conversationId) {
      return;
    }

    addTemporaryConversation();
  }, [addTemporaryConversation, conversationId, dialogId]);

  return {
    list,
    addTemporaryConversation,
    loading,
    handleInputChange,
    searchString,
  };
};
