/**
 * ChatHistory — 对话历史回看面板
 *
 * 从右侧滑入的半透明面板，按日期分组展示历史对话。
 */

import { useEffect, useRef, useMemo } from 'react';
import { useChatStore, HistoryMessage } from '../store/useChatStore';
import './ChatHistory.css';

interface ChatHistoryProps {
  visible?: boolean;
  onClose?: () => void;
  /** 独立窗口模式（无遮罩、全屏） */
  standalone?: boolean;
}

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

  // 保持插入顺序，今天在前
  const order = ['今天', '昨天'];
  const result: DateGroup[] = [];

  for (const key of order) {
    if (groups[key]) result.push({ label: key, messages: groups[key] });
  }

  // 其他日期按时间降序
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

export default function ChatHistory({ visible, onClose, standalone }: ChatHistoryProps) {
  const messages = useChatStore(s => s.messages);
  const panelRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => groupByDate(messages), [messages]);

  // 独立模式：自动滚动到底部
  useEffect(() => {
    if (standalone || visible) {
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 200);
    }
  }, [standalone, visible, messages.length]);

  // Escape 关闭（非独立模式）
  useEffect(() => {
    if (standalone || !visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [standalone, visible, onClose]);

  // 独立模式直接渲染为主视图
  if (standalone) {
    return (
      <div className="chathistory-standalone" ref={panelRef}>
        <div className="chathistory-header">
          <span className="chathistory-title">对话历史</span>
          <div className="chathistory-header-actions">
            <button
              className="chathistory-clear"
              onClick={() => useChatStore.getState().clearHistory()}
              title="清空历史"
            >
              清空
            </button>
          </div>
        </div>
        <div className="chathistory-list">
          {groups.length === 0 ? (
            <div className="chathistory-empty">暂无对话记录</div>
          ) : (
            groups.map(group => (
              <div key={group.label} className="chathistory-group">
                <div className="chathistory-date-label">{group.label}</div>
                {group.messages.map(msg => (
                  <div key={msg.id} className={`chathistory-msg chathistory-msg--${msg.role}`}>
                    <span className="chathistory-msg-icon">{roleIcon(msg.role)}</span>
                    <div className="chathistory-msg-body">
                      <div className="chathistory-msg-content">{msg.content}</div>
                      <span className="chathistory-msg-time">{formatTime(msg.timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>
      </div>
    );
  }

  if (!visible) return null;

  return (
    <div className="chathistory-overlay" onClick={onClose}>
      <div className="chathistory-panel" ref={panelRef} onClick={e => e.stopPropagation()}>
        {/* 头部 */}
        <div className="chathistory-header">
          <span className="chathistory-title">对话历史</span>
          <div className="chathistory-header-actions">
            <button
              className="chathistory-clear"
              onClick={() => useChatStore.getState().clearHistory()}
              title="清空历史"
            >
              清空
            </button>
            <button className="chathistory-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* 消息列表 */}
        <div className="chathistory-list">
          {groups.length === 0 ? (
            <div className="chathistory-empty">暂无对话记录</div>
          ) : (
            groups.map(group => (
              <div key={group.label} className="chathistory-group">
                <div className="chathistory-date-label">{group.label}</div>
                {group.messages.map(msg => (
                  <div key={msg.id} className={`chathistory-msg chathistory-msg--${msg.role}`}>
                    <span className="chathistory-msg-icon">{roleIcon(msg.role)}</span>
                    <div className="chathistory-msg-body">
                      <div className="chathistory-msg-content">{msg.content}</div>
                      <span className="chathistory-msg-time">{formatTime(msg.timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>
      </div>
    </div>
  );
}
