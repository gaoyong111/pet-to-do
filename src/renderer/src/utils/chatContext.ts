/**
 * AI 对话上下文构建
 * 单一数据源：useChatStore 持久化历史 → 提取 AI 轮次 → 组装 system + messages
 */
import { ChatMessage } from './aiChatService';
import { HistoryMessage, getEffectiveContent } from '../store/useChatStore';
import { loadSystemPromptFromStorage } from './systemPrompt';

/** 参与 AI 上下文的最大消息条数（user + assistant） */
export const AI_CONTEXT_MAX_MESSAGES = 16;

/** 从持久化历史中构建发给模型的 messages */
export function buildAIContext(
  messages: HistoryMessage[],
  maxMessages = AI_CONTEXT_MAX_MESSAGES
): ChatMessage[] {
  const turns = messages
    .filter(
      (m) =>
        m.source === 'ai' &&
        (m.role === 'user' || m.role === 'assistant') &&
        getEffectiveContent(m)
    )
    .slice(-maxMessages)
    .map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: getEffectiveContent(m),
    }));

  return [{ role: 'system', content: loadSystemPromptFromStorage() }, ...turns];
}
