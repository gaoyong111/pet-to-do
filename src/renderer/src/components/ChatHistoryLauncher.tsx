import { useCallback } from 'react';
import { useChatStore } from '../store/useChatStore';
import './ChatHistoryLauncher.css';

export const ChatHistoryLauncher = () => {
  const unreadCount = useChatStore((s) =>
    s.messages.filter((m) => m.timestamp > s.lastReadAt && m.role !== 'user').length
  );

  const handleClick = useCallback(async () => {
    await window.petAPI?.toggleChatHistoryWindow();
  }, []);

  return (
    <div className="chlauncher-container">
      <button
        className="chlauncher-toggle"
        onClick={handleClick}
        title="对话历史"
      >
        💬
        {unreadCount > 0 && (
          <span className="chlauncher-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>
    </div>
  );
};
