import { useState, useEffect, useCallback, useRef } from 'react';
import './TodoLauncher.css';
import { isInTodayView } from './TodoApp/utils/taskFilter';

type DisplayMode = 'all' | 'today' | 'none';

const STORAGE_KEY = 'todolauncher-display-mode';

function loadMode(): DisplayMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'all' || saved === 'today' || saved === 'none') return saved;
  } catch { /* ignore */ }
  return 'all';
}

export const TodoLauncher = () => {
  const [taskCount, setTaskCount] = useState(0);
  const [displayMode, setDisplayMode] = useState<DisplayMode>(loadMode);
  const [showMenu, setShowMenu] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchCount = useCallback(async () => {
    if (!window.petAPI?.taskGetAll) return;
    try {
      const tasks = await window.petAPI.taskGetAll();
      const mode = loadMode();
      if (mode === 'none') {
        setTaskCount(0);
        return;
      }
      const pending = tasks.filter((t: any) => {
        if (t.status === 'completed') return false;
        if (mode === 'today') return isInTodayView(t);
        return true;
      });
      setTaskCount(pending.length);
    } catch {
      // 静默忽略
    }
  }, []);

  // 定时刷新
  useEffect(() => {
    fetchCount();
    const timer = setInterval(fetchCount, 30000);
    return () => clearInterval(timer);
  }, [fetchCount]);

  // 点击外部关闭菜单
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const handleClick = useCallback(async () => {
    await window.petAPI?.toggleTodoWindow();
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setShowMenu(prev => !prev);
  }, []);

  const switchMode = useCallback((mode: DisplayMode) => {
    setDisplayMode(mode);
    setShowMenu(false);
    localStorage.setItem(STORAGE_KEY, mode);
    // 立即刷新计数
    setTimeout(fetchCount, 50);
  }, [fetchCount]);

  const modeLabel: Record<DisplayMode, string> = {
    all: '全部待办',
    today: '今日待办',
    none: '隐藏数量',
  };

  return (
    <div className="todolauncher-container" ref={containerRef}>
      <button
        className="todolauncher-toggle"
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        title={`任务管理（${modeLabel[displayMode]}）`}
      >
        📋
        {displayMode !== 'none' && taskCount > 0 && (
          <span className="todolauncher-badge">{taskCount > 99 ? '99+' : taskCount}</span>
        )}
      </button>

      {showMenu && (
        <div className="todolauncher-menu">
          <div className="todolauncher-menu-title">待办计数模式</div>
          {(['all', 'today', 'none'] as DisplayMode[]).map(mode => (
            <button
              key={mode}
              className={`todolauncher-menu-item ${displayMode === mode ? 'active' : ''}`}
              onClick={() => switchMode(mode)}
            >
              <span className="todolauncher-menu-check">
                {displayMode === mode ? '●' : '○'}
              </span>
              {modeLabel[mode]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
