import { useCallback } from 'react';
import { useChatStore } from '../store/useChatStore';
import './ChatHistoryLauncher.css';

export const ChatHistoryLauncher = () => {
  const messages = useChatStore(s => s.messages);
  const count = messages.length;

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
        {count > 0 && (
          <span className="chlauncher-badge">{count > 99 ? '99+' : count}</span>
        )}
      </button>
    </div>
  );
};
