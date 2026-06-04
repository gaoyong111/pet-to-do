/**
 * 对话历史 Store（Zustand + localStorage 持久化）
 *
 * 保存所有用户与桌宠的聊天记录，支持：
 *   - 添加消息（自动去重最近一条相同内容）
 *   - 清空历史
 *   - 保留最多 200 条消息
 */

import { create } from 'zustand';

/** 消息角色 */
export type ChatRole = 'user' | 'pet' | 'assistant';

/** 消息来源标记 */
export type ChatSource = 'command' | 'ai' | 'phrase' | 'system';

/** 单条历史消息 */
export interface HistoryMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: number;    // Date.now()
  source: ChatSource;
}

interface ChatHistoryState {
  messages: HistoryMessage[];

  addMessage: (msg: Omit<HistoryMessage, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;
  loadFromStorage: () => void;
}

const STORAGE_KEY = 'pet-chat-history';
const MAX_MESSAGES = 200;

function saveStorage(messages: HistoryMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch { /* 静默失败 */ }
}

export const useChatStore = create<ChatHistoryState>((set, get) => ({
  messages: [],

  addMessage: (msg) => {
    const { messages } = get();

    // 去重：如果最近一条消息内容完全相同则跳过
    const last = messages[messages.length - 1];
    if (last && last.role === msg.role && last.content === msg.content) return;

    const newMsg: HistoryMessage = {
      ...msg,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      timestamp: Date.now(),
    };

    const updated = [...messages, newMsg].slice(-MAX_MESSAGES);
    set({ messages: updated });
    saveStorage(updated);
  },

  clearHistory: () => {
    set({ messages: [] });
    saveStorage([]);
  },

  loadFromStorage: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          set({ messages: parsed.slice(-MAX_MESSAGES) });
        }
      }
    } catch { /* 静默失败 */ }
  },
}));
