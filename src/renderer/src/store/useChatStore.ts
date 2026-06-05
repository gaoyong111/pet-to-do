/**
 * 对话历史 Store（Zustand + localStorage 持久化）
 *
 * 单一数据源：UI 历史回看 + AI 上下文（见 utils/chatContext.ts buildAIContext）
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
  /** 用户二次编辑文案：仅用于历史展示与 AI 上下文，不改变原始 content */
  displayContent?: string;
  timestamp: number;    // Date.now()
  source: ChatSource;
}

/** 参与 AI 上下文 / 历史展示的有效文案 */
export function getEffectiveContent(msg: HistoryMessage): string {
  return (msg.displayContent ?? msg.content).trim();
}

interface ChatHistoryState {
  messages: HistoryMessage[];
  /** 上次已读时间戳（此时间之后来自桌宠/AI 的消息计为未读） */
  lastReadAt: number;

  addMessage: (msg: Omit<HistoryMessage, 'id' | 'timestamp'>) => void;
  deleteMessage: (id: string) => void;
  /** 从指定下标起删除后续消息（含自身） */
  deleteMessagesFromIndex: (fromIndex: number) => void;
  setDisplayContent: (id: string, displayContent: string | undefined) => void;
  clearHistory: () => void;
  loadFromStorage: () => void;
  markAllRead: () => void;
  getUnreadCount: () => number;
}

const STORAGE_KEY = 'pet-chat-history';
const LAST_READ_KEY = 'pet-chat-last-read-at';
const MAX_MESSAGES = 200;

function saveStorage(messages: HistoryMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch { /* 静默失败 */ }
}

function saveLastReadAt(ts: number) {
  try {
    localStorage.setItem(LAST_READ_KEY, String(ts));
  } catch { /* 静默失败 */ }
}

function loadLastReadAtFromStorage(): number {
  try {
    const raw = localStorage.getItem(LAST_READ_KEY);
    if (raw) {
      const n = Number(raw);
      if (!Number.isNaN(n)) return n;
    }
  } catch { /* 静默失败 */ }
  return 0;
}

function countUnread(messages: HistoryMessage[], lastReadAt: number): number {
  return messages.filter(
    (m) => m.timestamp > lastReadAt && m.role !== 'user'
  ).length;
}

export const useChatStore = create<ChatHistoryState>((set, get) => ({
  messages: [],
  lastReadAt: 0,

  addMessage: (msg) => {
    get().loadFromStorage();
    const { messages, lastReadAt } = get();

    const last = messages[messages.length - 1];
    if (last && last.role === msg.role && last.content === msg.content) return;

    const newMsg: HistoryMessage = {
      ...msg,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      timestamp: Date.now(),
    };

    const updated = [...messages, newMsg].slice(-MAX_MESSAGES);
    set({ messages: updated, lastReadAt });
    saveStorage(updated);
  },

  deleteMessage: (id) => {
    get().loadFromStorage();
    const { messages, lastReadAt } = get();
    const updated = messages.filter((m) => m.id !== id);
    if (updated.length === messages.length) return;
    set({ messages: updated, lastReadAt });
    saveStorage(updated);
  },

  deleteMessagesFromIndex: (fromIndex) => {
    get().loadFromStorage();
    const { messages, lastReadAt } = get();
    if (fromIndex < 0 || fromIndex >= messages.length) return;
    const updated = messages.slice(0, fromIndex);
    set({ messages: updated, lastReadAt });
    saveStorage(updated);
  },

  setDisplayContent: (id, displayContent) => {
    get().loadFromStorage();
    const { messages, lastReadAt } = get();
    const trimmed = displayContent?.trim();
    const updated = messages.map((m) => {
      if (m.id !== id) return m;
      if (!trimmed || trimmed === m.content.trim()) {
        const { displayContent: _removed, ...rest } = m;
        return rest as HistoryMessage;
      }
      return { ...m, displayContent: trimmed };
    });
    set({ messages: updated, lastReadAt });
    saveStorage(updated);
  },

  clearHistory: () => {
    const now = Date.now();
    set({ messages: [], lastReadAt: now });
    saveStorage([]);
    saveLastReadAt(now);
  },

  loadFromStorage: () => {
    let messages: HistoryMessage[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          messages = parsed.slice(-MAX_MESSAGES);
        }
      }
    } catch {
      messages = [];
    }

    let lastReadAt = loadLastReadAtFromStorage();
    // 首次升级：历史消息视为已读，避免徽章一次性显示全部条数
    if (localStorage.getItem(LAST_READ_KEY) === null && messages.length > 0) {
      lastReadAt = Math.max(...messages.map((m) => m.timestamp));
      saveLastReadAt(lastReadAt);
    }

    set({ messages, lastReadAt });
  },

  markAllRead: () => {
    const { messages } = get();
    const ts = messages.length
      ? Math.max(...messages.map((m) => m.timestamp))
      : Date.now();
    set({ lastReadAt: ts });
    saveLastReadAt(ts);
  },

  getUnreadCount: () => {
    const { messages, lastReadAt } = get();
    return countUnread(messages, lastReadAt);
  },
}));

/** 跨窗口同步：历史窗口清空/新增时，主窗口等其它窗口刷新内存状态 */
export function initChatStorageSync(): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === LAST_READ_KEY) {
      useChatStore.getState().loadFromStorage();
    }
  };

  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
