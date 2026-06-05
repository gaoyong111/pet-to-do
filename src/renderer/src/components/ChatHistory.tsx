/**
 * ChatHistory — 对话历史窗口（独立 BrowserWindow 或内嵌面板）
 */

import { useEffect, useRef, useMemo, useState, RefObject, useCallback } from 'react';
import { useChatStore, HistoryMessage, ChatSource, getEffectiveContent } from '../store/useChatStore';
import { regenerateFromMessage } from '../utils/aiChatReply';
import './ChatHistory.css';

interface ChatHistoryProps {
  visible?: boolean;
  onClose?: () => void;
  /** 独立窗口模式（无遮罩、全屏） */
  standalone?: boolean;
}

type HistoryFilter = 'all' | ChatSource;

const FILTER_OPTIONS: { id: HistoryFilter; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'ai', label: 'AI' },
  { id: 'command', label: '命令' },
  { id: 'phrase', label: '短语' },
  { id: 'system', label: '系统' },
];

/** 日期分组 */
interface DateGroup {
  label: string;
  messages: HistoryMessage[];
}

/** 格式化时间为 HH:mm */
function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 按日期分组 */
function groupByDate(messages: HistoryMessage[]): DateGroup[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;

  const groups: Record<string, HistoryMessage[]> = {};

  for (const msg of messages) {
    const msgDay = new Date(msg.timestamp);
    const msgDayStart = new Date(msgDay.getFullYear(), msgDay.getMonth(), msgDay.getDate()).getTime();

    let label: string;
    if (msgDayStart === today) {
      label = '今天';
    } else if (msgDayStart === yesterday) {
      label = '昨天';
    } else {
      label = `${msgDay.getMonth() + 1}月${msgDay.getDate()}日`;
    }

    if (!groups[label]) groups[label] = [];
    groups[label].push(msg);
  }

  const order = ['今天', '昨天'];
  const result: DateGroup[] = [];

  for (const key of order) {
    if (groups[key]) result.push({ label: key, messages: groups[key] });
  }

  const others = Object.entries(groups)
    .filter(([k]) => !order.includes(k))
    .sort((a, b) => b[1][0].timestamp - a[1][0].timestamp);

  for (const [key, msgs] of others) {
    result.push({ label: key, messages: msgs });
  }

  return result;
}

/** 角色图标 */
function roleIcon(role: string): string {
  switch (role) {
    case 'user': return '👤';
    case 'pet': return '🐱';
    case 'assistant': return '🤖';
    default: return '💬';
  }
}

function sourceLabel(source: ChatSource): string {
  switch (source) {
    case 'ai': return 'AI';
    case 'command': return '命令';
    case 'phrase': return '短语';
    case 'system': return '系统';
  }
}

function canRegenerate(msg: HistoryMessage): boolean {
  return msg.source === 'ai' && (msg.role === 'user' || msg.role === 'assistant');
}

function HistoryFilterBar({
  filter,
  onChange,
}: {
  filter: HistoryFilter;
  onChange: (f: HistoryFilter) => void;
}) {
  return (
    <div className="chathistory-filters">
      {FILTER_OPTIONS.map(opt => (
        <button
          key={opt.id}
          className={`chathistory-filter-btn ${filter === opt.id ? 'active' : ''}`}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function MessageRow({
  msg,
  editingId,
  editDraft,
  regeneratingId,
  onStartEdit,
  onEditDraftChange,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onRegenerate,
}: {
  msg: HistoryMessage;
  editingId: string | null;
  editDraft: string;
  regeneratingId: string | null;
  onStartEdit: (msg: HistoryMessage) => void;
  onEditDraftChange: (value: string) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onRegenerate: (id: string) => void;
}) {
  const isEditing = editingId === msg.id;
  const isRegenerating = regeneratingId === msg.id;
  const displayText = getEffectiveContent(msg);
  const isEdited = Boolean(msg.displayContent && msg.displayContent.trim() !== msg.content.trim());

  return (
    <div className={`chathistory-msg chathistory-msg--${msg.role} ${isRegenerating ? 'chathistory-msg--loading' : ''}`}>
      <span className="chathistory-msg-icon">{roleIcon(msg.role)}</span>
      <div className="chathistory-msg-body">
        <div className="chathistory-msg-meta">
          <span className={`chathistory-source chathistory-source--${msg.source}`}>
            {sourceLabel(msg.source)}
          </span>
          {isEdited && <span className="chathistory-edited-badge">已编辑</span>}
          <span className="chathistory-msg-time">{formatTime(msg.timestamp)}</span>
        </div>

        {isEditing ? (
          <div className="chathistory-edit-box">
            <textarea
              className="chathistory-edit-input"
              value={editDraft}
              onChange={(e) => onEditDraftChange(e.target.value)}
              rows={3}
              autoFocus
            />
            <div className="chathistory-edit-actions">
              <button className="chathistory-action-btn" onClick={() => onSaveEdit(msg.id)}>保存</button>
              <button className="chathistory-action-btn chathistory-action-btn--muted" onClick={onCancelEdit}>取消</button>
              {isEdited && (
                <button
                  className="chathistory-action-btn chathistory-action-btn--muted"
                  onClick={() => {
                    useChatStore.getState().setDisplayContent(msg.id, undefined);
                    onCancelEdit();
                  }}
                >
                  恢复原文
                </button>
              )}
            </div>
            <div className="chathistory-edit-hint">编辑仅影响展示与后续 AI 上下文，不修改原始记录</div>
          </div>
        ) : (
          <>
            <div className="chathistory-msg-content">{displayText}</div>
            {isEdited && (
              <div className="chathistory-original-content" title="原始内容">
                原文：{msg.content}
              </div>
            )}
          </>
        )}

        {!isEditing && (
          <div className="chathistory-msg-actions">
            <button
              className="chathistory-action-btn"
              title="自定义编辑"
              onClick={() => onStartEdit(msg)}
            >
              编辑
            </button>
            {canRegenerate(msg) && (
              <button
                className="chathistory-action-btn"
                title="重新生成 AI 回复"
                disabled={Boolean(regeneratingId)}
                onClick={() => onRegenerate(msg.id)}
              >
                {isRegenerating ? '生成中…' : '重答'}
              </button>
            )}
            <button
              className="chathistory-action-btn chathistory-action-btn--danger"
              title="删除此条"
              onClick={() => onDelete(msg.id)}
            >
              删除
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageList({
  groups,
  endRef,
  emptyText,
  editingId,
  editDraft,
  regeneratingId,
  onStartEdit,
  onEditDraftChange,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onRegenerate,
}: {
  groups: DateGroup[];
  endRef: RefObject<HTMLDivElement>;
  emptyText: string;
  editingId: string | null;
  editDraft: string;
  regeneratingId: string | null;
  onStartEdit: (msg: HistoryMessage) => void;
  onEditDraftChange: (value: string) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onRegenerate: (id: string) => void;
}) {
  if (groups.length === 0) {
    return <div className="chathistory-empty">{emptyText}</div>;
  }

  return (
    <>
      {groups.map(group => (
        <div key={group.label} className="chathistory-group">
          <div className="chathistory-date-label">{group.label}</div>
          {group.messages.map(msg => (
            <MessageRow
              key={msg.id}
              msg={msg}
              editingId={editingId}
              editDraft={editDraft}
              regeneratingId={regeneratingId}
              onStartEdit={onStartEdit}
              onEditDraftChange={onEditDraftChange}
              onSaveEdit={onSaveEdit}
              onCancelEdit={onCancelEdit}
              onDelete={onDelete}
              onRegenerate={onRegenerate}
            />
          ))}
        </div>
      ))}
      <div ref={endRef} />
    </>
  );
}

export default function ChatHistory({ visible, onClose, standalone }: ChatHistoryProps) {
  const messages = useChatStore(s => s.messages);
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const filteredMessages = useMemo(
    () => (filter === 'all' ? messages : messages.filter(m => m.source === filter)),
    [messages, filter]
  );
  const groups = useMemo(() => groupByDate(filteredMessages), [filteredMessages]);

  const emptyText = filter === 'all' ? '暂无对话记录' : `暂无「${FILTER_OPTIONS.find(o => o.id === filter)?.label}」类消息`;

  const handleStartEdit = useCallback((msg: HistoryMessage) => {
    setEditingId(msg.id);
    setEditDraft(getEffectiveContent(msg));
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft('');
  }, []);

  const handleSaveEdit = useCallback((id: string) => {
    useChatStore.getState().setDisplayContent(id, editDraft);
    handleCancelEdit();
  }, [editDraft, handleCancelEdit]);

  const handleDelete = useCallback((id: string) => {
    if (!window.confirm('确定删除这条消息吗？')) return;
    if (editingId === id) handleCancelEdit();
    useChatStore.getState().deleteMessage(id);
  }, [editingId, handleCancelEdit]);

  const handleRegenerate = useCallback(async (id: string) => {
    if (regeneratingId) return;
    setRegeneratingId(id);

    const relayBubble = standalone && window.petAPI?.relayToMain;

    try {
      await regenerateFromMessage(id, relayBubble ? {
        onStreamStart: () => { window.petAPI?.relayToMain('chat-stream-start'); },
        onStreamChunk: (text) => { window.petAPI?.relayToMain('chat-stream-chunk', text); },
        onStreamEnd: (text) => { window.petAPI?.relayToMain('chat-stream-end', text); },
        onError: (reason) => { window.petAPI?.relayToMain('chat-stream-error', reason); },
      } : undefined);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 200);
    } finally {
      setRegeneratingId(null);
    }
  }, [regeneratingId, standalone]);

  useEffect(() => {
    useChatStore.getState().loadFromStorage();
  }, []);

  useEffect(() => {
    if (standalone || visible) {
      useChatStore.getState().markAllRead();
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 200);
    }
  }, [standalone, visible, filteredMessages.length, filter]);

  useEffect(() => {
    if (standalone || !visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [standalone, visible, onClose]);

  const listProps = {
    groups,
    endRef,
    emptyText,
    editingId,
    editDraft,
    regeneratingId,
    onStartEdit: handleStartEdit,
    onEditDraftChange: setEditDraft,
    onSaveEdit: handleSaveEdit,
    onCancelEdit: handleCancelEdit,
    onDelete: handleDelete,
    onRegenerate: handleRegenerate,
  };

  if (standalone) {
    return (
      <div className="chathistory-standalone" ref={panelRef}>
        <div className="chathistory-header">
          <span className="chathistory-title">对话历史</span>
          <div className="chathistory-header-actions">
            <button
              className="chathistory-clear"
              onClick={() => {
                if (window.confirm('确定清空全部历史吗？')) {
                  useChatStore.getState().clearHistory();
                }
              }}
              title="清空历史"
            >
              清空
            </button>
          </div>
        </div>
        <HistoryFilterBar filter={filter} onChange={setFilter} />
        <div className="chathistory-list">
          <MessageList {...listProps} />
        </div>
      </div>
    );
  }

  if (!visible) return null;

  return (
    <div className="chathistory-overlay" onClick={onClose}>
      <div className="chathistory-panel" ref={panelRef} onClick={e => e.stopPropagation()}>
        <div className="chathistory-header">
          <span className="chathistory-title">对话历史</span>
          <div className="chathistory-header-actions">
            <button
              className="chathistory-clear"
              onClick={() => {
                if (window.confirm('确定清空全部历史吗？')) {
                  useChatStore.getState().clearHistory();
                }
              }}
              title="清空历史"
            >
              清空
            </button>
            <button className="chathistory-close" onClick={onClose}>✕</button>
          </div>
        </div>
        <HistoryFilterBar filter={filter} onChange={setFilter} />
        <div className="chathistory-list">
          <MessageList {...listProps} />
        </div>
      </div>
    </div>
  );
}
