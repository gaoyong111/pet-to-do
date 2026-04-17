import { useState, useEffect, useCallback } from 'react';
import { PomodoroState, PomodoroStateInfo, PomodoroConfig } from '../types';
import './Pomodoro.css';

/**
 * 番茄钟组件
 * 显示番茄钟状态和剩余时间，提供控制按钮
 */
function Pomodoro(): JSX.Element {
  const [pomodoroState, setPomodoroState] = useState<PomodoroStateInfo>({
    state: 'idle',
    remainingTime: 0
  });
  const [isVisible, setIsVisible] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState<PomodoroConfig>({
    workDuration: 25,
    breakDuration: 5,
    longBreakDuration: 15,
    sessionsBeforeLongBreak: 4
  });

  /**
   * 格式化剩余时间为 MM:SS 格式
   * @param seconds - 剩余时间（秒）
   * @returns 格式化后的时间字符串
   */
  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  /**
   * 更新番茄钟状态
   */
  const updatePomodoroState = useCallback(async () => {
    if (window.petAPI) {
      try {
        const state = await window.petAPI.pomodoroGetState();
        setPomodoroState(state as PomodoroStateInfo);
      } catch (error) {
        console.error('获取番茄钟状态失败:', error);
      }
    }
  }, []);

  /**
   * 开始番茄钟
   */
  const handleStart = useCallback(async () => {
    if (window.petAPI) {
      try {
        const state = await window.petAPI.pomodoroStart();
        setPomodoroState(state as PomodoroStateInfo);
      } catch (error) {
        console.error('开始番茄钟失败:', error);
      }
    }
  }, []);

  /**
   * 暂停番茄钟
   */
  const handlePause = useCallback(async () => {
    if (window.petAPI) {
      try {
        const state = await window.petAPI.pomodoroPause();
        setPomodoroState(state as PomodoroStateInfo);
      } catch (error) {
        console.error('暂停番茄钟失败:', error);
      }
    }
  }, []);

  /**
   * 停止番茄钟
   */
  const handleStop = useCallback(async () => {
    if (window.petAPI) {
      try {
        const state = await window.petAPI.pomodoroStop();
        setPomodoroState(state as PomodoroStateInfo);
      } catch (error) {
        console.error('停止番茄钟失败:', error);
      }
    }
  }, []);

  /**
   * 恢复番茄钟
   */
  const handleResume = useCallback(async () => {
    if (window.petAPI) {
      try {
        const state = await window.petAPI.pomodoroResume();
        setPomodoroState(state as PomodoroStateInfo);
      } catch (error) {
        console.error('恢复番茄钟失败:', error);
      }
    }
  }, []);

  /**
   * 保存配置
   */
  const handleSaveConfig = useCallback(async () => {
    if (window.petAPI) {
      try {
        await window.petAPI.pomodoroSetConfig(config);
        setShowConfig(false);
      } catch (error) {
        console.error('保存配置失败:', error);
      }
    }
  }, [config]);

  /**
   * 切换组件可见性
   */
  const toggleVisibility = useCallback(() => {
    setIsVisible(!isVisible);
  }, [isVisible]);

  /**
   * 切换配置面板
   */
  const toggleConfig = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfig(!showConfig);
  }, [showConfig]);

  /**
   * 更新配置值
   */
  const updateConfigValue = useCallback((key: keyof PomodoroConfig, value: number) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  // 定时更新番茄钟状态
  useEffect(() => {
    updatePomodoroState();
    const interval = setInterval(updatePomodoroState, 1000);
    return () => clearInterval(interval);
  }, [updatePomodoroState]);

  /**
   * 获取状态对应的文本
   * @param state - 番茄钟状态
   * @returns 状态文本
   */
  const getStateText = useCallback((state: PomodoroState): string => {
    switch (state) {
      case 'work':
        return '工作中';
      case 'break':
        return '短休息';
      case 'longBreak':
        return '长休息';
      case 'pause':
        return '已暂停';
      default:
        return '就绪';
    }
  }, []);

  /**
   * 获取状态对应的颜色
   * @param state - 番茄钟状态
   * @returns 状态颜色
   */
  const getStateColor = useCallback((state: PomodoroState): string => {
    switch (state) {
      case 'work':
        return '#FF6347';
      case 'break':
        return '#4682B4';
      case 'longBreak':
        return '#32CD32';
      case 'pause':
        return '#FFA500';
      default:
        return '#999999';
    }
  }, []);

  return (
    <div className="pomodoro-container">
      <button 
        className="pomodoro-toggle" 
        onClick={toggleVisibility}
        style={{ backgroundColor: getStateColor(pomodoroState.state) }}
      >
        {isVisible ? '×' : '🍅'}
      </button>
      
      {isVisible && (
        <div className="pomodoro-panel">
          <div className="pomodoro-header">
            <h3>番茄钟</h3>
            <div className="header-buttons">
              <button className="config-btn" onClick={toggleConfig}>
                ⚙️
              </button>
              <span className="pomodoro-state" style={{ color: getStateColor(pomodoroState.state) }}>
                {getStateText(pomodoroState.state)}
              </span>
            </div>
          </div>
          
          {showConfig ? (
            <div className="config-panel">
              <div className="config-item">
                <label>工作时长（分钟）:</label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={config.workDuration}
                  onChange={(e) => updateConfigValue('workDuration', parseInt(e.target.value) || 25)}
                />
              </div>
              <div className="config-item">
                <label>短休息（分钟）:</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={config.breakDuration}
                  onChange={(e) => updateConfigValue('breakDuration', parseInt(e.target.value) || 5)}
                />
              </div>
              <div className="config-item">
                <label>长休息（分钟）:</label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={config.longBreakDuration}
                  onChange={(e) => updateConfigValue('longBreakDuration', parseInt(e.target.value) || 15)}
                />
              </div>
              <div className="config-item">
                <label>长休息前工作次数:</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={config.sessionsBeforeLongBreak}
                  onChange={(e) => updateConfigValue('sessionsBeforeLongBreak', parseInt(e.target.value) || 4)}
                />
              </div>
              <button className="save-config-btn" onClick={handleSaveConfig}>
                保存配置
              </button>
            </div>
          ) : (
            <>
              <div className="pomodoro-timer">
                {formatTime(pomodoroState.remainingTime)}
              </div>
              
              <div className="pomodoro-controls">
                {pomodoroState.state === 'idle' && (
                  <button className="pomodoro-btn start" onClick={handleStart}>
                    开始
                  </button>
                )}
                
                {(pomodoroState.state === 'work' || pomodoroState.state === 'break' || pomodoroState.state === 'longBreak') && (
                  <button className="pomodoro-btn pause" onClick={handlePause}>
                    暂停
                  </button>
                )}
                
                {pomodoroState.state === 'pause' && (
                  <>
                    <button className="pomodoro-btn resume" onClick={handleResume}>
                      恢复
                    </button>
                  </>
                )}
                
                {(pomodoroState.state !== 'idle') && (
                  <button className="pomodoro-btn stop" onClick={handleStop}>
                    停止
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default Pomodoro;
