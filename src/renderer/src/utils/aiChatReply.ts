/**
 * AI 回复请求（ChatInput / 历史重答共用）
 */
import { getAIChatService, loadAIConfig, ChatAbortedError } from './aiChatService';
import { buildAIContext } from './chatContext';
import { useChatStore } from '../store/useChatStore';
import { getRandomDialogue } from '../i18n';

export interface AIReplyCallbacks {
  onStreamStart?: () => void;
  onStreamChunk?: (text: string) => void;
  onStreamEnd?: (text: string) => void;
  onError?: (message: string) => void;
}

/** 基于当前 store 消息请求 AI 回复并写入历史 */
export async function requestAIReply(callbacks?: AIReplyCallbacks): Promise<string | null> {
  const aiConfig = loadAIConfig();
  const aiService = getAIChatService();
  aiService.setConfig(aiConfig);

  if (!aiConfig.enabled || !aiService.isAvailable()) {
    callbacks?.onError?.('AI 未启用或不可用');
    return null;
  }

  const context = buildAIContext(useChatStore.getState().messages);
  callbacks?.onStreamStart?.();

  let streamText = '';
  try {
    const result = await aiService.chatStream(context, (chunk) => {
      streamText = chunk;
      callbacks?.onStreamChunk?.(chunk);
    });

    if (result?.trim()) {
      const finalText = result.trim();
      useChatStore.getState().addMessage({
        role: 'assistant',
        content: finalText,
        source: 'ai',
      });
      callbacks?.onStreamEnd?.(finalText);
      return finalText;
    }

    const phrase = getRandomDialogue('chatFallback') || getRandomDialogue('idle') || '唔...';
    useChatStore.getState().addMessage({
      role: 'pet',
      content: phrase,
      source: 'phrase',
    });
    callbacks?.onStreamEnd?.(phrase);
    return phrase;
  } catch (err) {
    if (err instanceof ChatAbortedError || (err as Error).message === '已停止生成') {
      const partial = streamText.trim();
      if (partial) {
        const stoppedText = `${partial}（已停止）`;
        useChatStore.getState().addMessage({
          role: 'assistant',
          content: stoppedText,
          source: 'ai',
        });
        callbacks?.onStreamEnd?.(stoppedText);
        return stoppedText;
      }
      return null;
    }

    const reason = (err as Error).message || '连接失败';
    callbacks?.onError?.(reason);
    const phrase = getRandomDialogue('chatFallback') || getRandomDialogue('idle') || '嘛...';
    useChatStore.getState().addMessage({
      role: 'pet',
      content: `${phrase}（${reason}）`,
      source: 'system',
    });
    return null;
  }
}

/** 从指定 AI 消息重答：保留该轮用户提问，删除其后回复并重新生成 */
export async function regenerateFromMessage(
  messageId: string,
  callbacks?: AIReplyCallbacks
): Promise<boolean> {
  useChatStore.getState().loadFromStorage();
  const messages = useChatStore.getState().messages;
  const idx = messages.findIndex((m) => m.id === messageId);
  if (idx === -1) return false;

  const msg = messages[idx];
  if (msg.source !== 'ai') return false;

  if (msg.role === 'assistant') {
    useChatStore.getState().deleteMessagesFromIndex(idx);
  } else if (msg.role === 'user') {
    useChatStore.getState().deleteMessagesFromIndex(idx + 1);
  } else {
    return false;
  }

  const reply = await requestAIReply(callbacks);
  return reply !== null;
}
