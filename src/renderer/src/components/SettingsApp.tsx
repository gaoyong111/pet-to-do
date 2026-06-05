import { useState, useEffect, useCallback } from 'react';
import { getLocale, setLocale, subscribeLocaleChange, getAvailableLocales, Locale, t } from '../i18n';
import { AIConfig, AIProvider, DEFAULT_AI_CONFIG } from '../types';
import { loadAIConfig, saveAIConfig, getAIChatService } from '../utils/aiChatService';
import { DEFAULT_SYSTEM_PROMPT } from '../utils/systemPrompt';
import { getCharacterSourceHint, getCharacterSystemPrompt } from '../character/characterPhrases';
import { SKIN_GROUPS } from '../constants/skinGroups';
import { loadSkinPreference, saveSkinPreference } from '../utils/skinPreference';
import ViewCustomizePanel from './ViewCustomizePanel';
import BubbleCustomizePanel from './BubbleCustomizePanel';
import './SettingsApp.css';

/** 从当前皮肤 manifest 动态加载支持的状态/反应/文案 */
async function loadSkinCapabilities(skinId: string): Promise<{
  supportedStates: string[];
  supportedReactions: string[];
  stateLabels: Record<string, string>;
}> {
  try {
    const resp = await fetch(`/skins/${skinId}/manifest.json`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const m = await resp.json();
    return {
      supportedStates: m.supportedStates || ['idle'],
      supportedReactions: m.supportedReactions || [],
      stateLabels: m.stateLabels || { idle: '待机中' },
    };
  } catch {
    return { supportedStates: ['idle'], supportedReactions: [], stateLabels: { idle: '待机中' } };
  }
}

function SettingsApp(): JSX.Element {
    const [currentLocale, setCurrentLocale] = useState<Locale>(getLocale());
    const initialSkin = loadSkinPreference();
    const [currentGroup, setCurrentGroup] = useState(initialSkin.groupId);
    const [currentSkin, setCurrentSkin] = useState(initialSkin.skinId);
    const [currentState, setCurrentState] = useState<string>(() => {
        const saved = localStorage.getItem('pet-current-state');
        return saved || 'idle';
    });
    const [showPomodoro, setShowPomodoro] = useState(() => {
        const saved = localStorage.getItem('pet-show-pomodoro');
        return saved !== null ? saved === 'true' : true;
    });
    const [showReminder, setShowReminder] = useState(() => {
        const saved = localStorage.getItem('pet-show-reminder');
        return saved !== null ? saved === 'true' : true;
    });
    const [showTodoLauncher, setShowTodoLauncher] = useState(() => {
        const saved = localStorage.getItem('pet-show-todolauncher');
        return saved !== null ? saved === 'true' : true;
    });
    const [showChatHistoryLauncher, setShowChatHistoryLauncher] = useState(() => {
        const saved = localStorage.getItem('pet-show-chathistory');
        return saved !== null ? saved === 'true' : true;
    });
    const [supportedStates, setSupportedStates] = useState<string[]>(['idle']);
    const [supportedReactions, setSupportedReactions] = useState<string[]>([]);
    const [stateLabels, setStateLabels] = useState<Record<string, string>>({ idle: '待机中' });

    // === AI 配置 ===
    const [aiConfig, setAiConfig] = useState<AIConfig>(() => loadAIConfig());
    const [aiDetectedModels, setAiDetectedModels] = useState<string[]>([]);
    const [aiDetecting, setAiDetecting] = useState(false);
    const [aiDetectError, setAiDetectError] = useState<string | null>(null);
    const [aiTesting, setAiTesting] = useState(false);
    const [aiTestResult, setAiTestResult] = useState<{ ok: boolean; message: string } | null>(null);
    const [showApiKey, setShowApiKey] = useState(false);
    const [showViewCustomize, setShowViewCustomize] = useState(false);
    const [showBubbleCustomize, setShowBubbleCustomize] = useState(false);

    const currentGroupData = SKIN_GROUPS.find(group => group.id === currentGroup);
    const currentSkins = currentGroupData?.skins || [];
    const currentSkinName = currentSkins.find(s => s.id === currentSkin)?.name ?? currentSkin;

    useEffect(() => {
        return subscribeLocaleChange((locale: Locale) => {
            setCurrentLocale(locale);
        });
    }, []);

    // 皮肤切换时重新加载该皮肤支持的状态/反应/文案
    useEffect(() => {
        loadSkinCapabilities(currentSkin).then((caps) => {
            setSupportedStates(caps.supportedStates);
            setSupportedReactions(caps.supportedReactions);
            setStateLabels(caps.stateLabels);
        });
    }, [currentSkin]);

    const handleLocaleChange = useCallback((locale: Locale) => {
        setLocale(locale);
        setCurrentLocale(locale);
    }, []);

    const handleGroupChange = useCallback((groupId: string) => {
        setCurrentGroup(groupId);
        const group = SKIN_GROUPS.find(g => g.id === groupId);
        if (group && group.skins.length > 0) {
            const skinId = group.skins[0].id;
            setCurrentSkin(skinId);
            saveSkinPreference(groupId, skinId);
            if (window.petAPI) {
                window.petAPI.relayToMain('switch-skin', skinId);
            }
        }
    }, []);

    const handleSkinChange = useCallback((skinId: string) => {
        setCurrentSkin(skinId);
        saveSkinPreference(currentGroup, skinId);
        if (window.petAPI) {
            window.petAPI.relayToMain('switch-skin', skinId);
        }
    }, []);

    const handleStateChange = useCallback((state: string) => {
        setCurrentState(state);
        localStorage.setItem('pet-current-state', state);
        if (window.petAPI) {
            window.petAPI.relayToMain('set-pet-state', state);
        }
    }, []);

    const handleVisibilityChange = useCallback((key: string, value: boolean, event: string) => {
        localStorage.setItem(key, String(value));
        if (window.petAPI) {
            window.petAPI.relayToMain(event, value);
        }
    }, []);

    const handleQuit = useCallback(() => {
        if (window.petAPI) {
            window.petAPI.quitApp();
        }
    }, []);

    // === AI 配置处理 ===
    const handleAIProviderChange = useCallback((provider: AIProvider) => {
        setAiConfig(prev => {
            const next = { ...prev, provider };
            saveAIConfig(next);
            getAIChatService().setConfig(next);
            return next;
        });
    }, []);

    const handleAIEnabledToggle = useCallback(() => {
        setAiConfig(prev => {
            const next = { ...prev, enabled: !prev.enabled };
            saveAIConfig(next);
            getAIChatService().setConfig(next);
            return next;
        });
    }, []);

    const handleAIConfigChange = useCallback((field: string, value: string) => {
        setAiConfig(prev => {
            const next = { ...prev, [field]: value };
            saveAIConfig(next);
            getAIChatService().setConfig(next);
            return next;
        });
    }, []);

    const handleDetectOllama = useCallback(async () => {
        setAiDetecting(true);
        setAiDetectError(null);
        try {
            const svc = getAIChatService();
            const result = await svc.detectOllamaModels(aiConfig.ollamaUrl);
            setAiDetectedModels(result.models);

            if (result.url && result.url !== aiConfig.ollamaUrl) {
                handleAIConfigChange('ollamaUrl', result.url);
            }

            if (result.error) {
                setAiDetectError(result.error);
            } else if (result.models.length === 0) {
                setAiDetectError('已连接 Ollama，但没有可用的对话模型');
            } else {
                const current = aiConfig.ollamaModel;
                if (!current || !result.models.includes(current)) {
                    handleAIConfigChange('ollamaModel', result.models[0]);
                }
            }
        } catch (err) {
            setAiDetectedModels([]);
            setAiDetectError((err as Error).message || '检测失败');
        } finally {
            setAiDetecting(false);
        }
    }, [aiConfig.ollamaUrl, aiConfig.ollamaModel, handleAIConfigChange]);

    const handleTestAI = useCallback(async () => {
        setAiTesting(true);
        setAiTestResult(null);
        try {
            const svc = getAIChatService();
            svc.setConfig(aiConfig);
            if (aiConfig.provider === 'claude_cli') {
                // Claude CLI：发送简短测试
                const result = await svc.chat([
                    { role: 'user', content: '回复"OK"两个字，不要多说' }
                ]);
                if (result && result.includes('OK')) {
                    setAiTestResult({ ok: true, message: '连接成功！Claude CLI 正常。' });
                } else {
                    setAiTestResult({ ok: true, message: `连接成功，响应: "${result?.slice(0, 30)}"` });
                }
            } else {
                const result = await svc.testConnection();
                setAiTestResult(result);
            }
        } catch (err) {
            setAiTestResult({ ok: false, message: `测试异常: ${(err as Error).message}` });
        } finally {
            setAiTesting(false);
        }
    }, [aiConfig]);

    // 本地 Ollama 模式下自动检测模型
    useEffect(() => {
        if (aiConfig.provider === 'local') {
            handleDetectOllama();
        }
    }, [aiConfig.provider]); // eslint-disable-line react-hooks/exhaustive-deps

    const ToggleSwitch = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
        <div className={`toggle-switch${checked ? ' on' : ''}`} onClick={onChange}>
            <div className="track" />
            <div className="thumb" />
        </div>
    );

    return (
        <div className="settings-window">
            <h2 className="settings-window-title">⚙ 设置</h2>

            {/* 当前状态 */}
            <div className="section-header">当前状态</div>
            <div className="settings-card">
                <div className="state-placeholder">
                    ⚠️ 状态机功能待实现
                </div>
            </div>

            {/* 语言 */}
            <div className="section-header">语言与外观</div>
            <div className="settings-card">
                <div className="select-row">
                    <span className="select-row-label">{t('settings.language')}</span>
                    <select
                        value={currentLocale}
                        onChange={(e) => handleLocaleChange(e.target.value as Locale)}
                        className="settings-select"
                    >
                        {getAvailableLocales().map((locale) => (
                            <option key={locale.value} value={locale.value}>
                                {locale.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* 皮肤 */}
            <div className="settings-card">
                <div className="skin-row">
                    <div className="skin-col">
                        <div className="skin-col-label">分组</div>
                        <select
                            value={currentGroup}
                            onChange={(e) => handleGroupChange(e.target.value)}
                            className="settings-select"
                        >
                            {SKIN_GROUPS.map((group) => (
                                <option key={group.id} value={group.id}>
                                    {group.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="skin-col">
                        <div className="skin-col-label">皮肤</div>
                        <select
                            value={currentSkin}
                            onChange={(e) => handleSkinChange(e.target.value)}
                            className="settings-select"
                        >
                            {currentSkins.map((skin) => (
                                <option key={skin.id} value={skin.id}>
                                    {skin.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                <button
                    type="button"
                    className="view-customize-entry"
                    onClick={() => setShowViewCustomize(true)}
                >
                    <span>🎨 视图自定义配置</span>
                    <span className="view-customize-entry-arrow">›</span>
                </button>
                <button
                    type="button"
                    className="view-customize-entry"
                    onClick={() => setShowBubbleCustomize(true)}
                >
                    <span>💬 聊天气泡样式</span>
                    <span className="view-customize-entry-arrow">›</span>
                </button>
            </div>

            <ViewCustomizePanel
                open={showViewCustomize}
                skinId={currentSkin}
                skinName={currentSkinName}
                onClose={() => setShowViewCustomize(false)}
            />

            <BubbleCustomizePanel
                open={showBubbleCustomize}
                skinId={currentSkin}
                skinName={currentSkinName}
                onClose={() => setShowBubbleCustomize(false)}
            />

            {/* 主界面图标 */}
            <div className="section-header">主界面图标</div>
            <div className="settings-card">
                <div
                    className="switch-item"
                    onClick={() => {
                        setShowPomodoro(!showPomodoro);
                        handleVisibilityChange('pet-show-pomodoro', !showPomodoro, 'pomodoro-visibility');
                    }}
                >
                    <span className="switch-label">🍅 显示番茄钟</span>
                    <ToggleSwitch
                        checked={showPomodoro}
                        onChange={() => {
                            setShowPomodoro(!showPomodoro);
                            handleVisibilityChange('pet-show-pomodoro', !showPomodoro, 'pomodoro-visibility');
                        }}
                    />
                </div>
                <div
                    className="switch-item"
                    onClick={() => {
                        setShowReminder(!showReminder);
                        handleVisibilityChange('pet-show-reminder', !showReminder, 'reminder-visibility');
                    }}
                >
                    <span className="switch-label">🔔 显示提醒</span>
                    <ToggleSwitch
                        checked={showReminder}
                        onChange={() => {
                            setShowReminder(!showReminder);
                            handleVisibilityChange('pet-show-reminder', !showReminder, 'reminder-visibility');
                        }}
                    />
                </div>
                <div
                    className="switch-item"
                    onClick={() => {
                        setShowTodoLauncher(!showTodoLauncher);
                        handleVisibilityChange('pet-show-todolauncher', !showTodoLauncher, 'todolauncher-visibility');
                    }}
                >
                    <span className="switch-label">📋 显示任务</span>
                    <ToggleSwitch
                        checked={showTodoLauncher}
                        onChange={() => {
                            setShowTodoLauncher(!showTodoLauncher);
                            handleVisibilityChange('pet-show-todolauncher', !showTodoLauncher, 'todolauncher-visibility');
                        }}
                    />
                </div>
                <div
                    className="switch-item"
                    onClick={() => {
                        setShowChatHistoryLauncher(!showChatHistoryLauncher);
                        handleVisibilityChange('pet-show-chathistory', !showChatHistoryLauncher, 'chat-history-visibility');
                    }}
                >
                    <span className="switch-label">💬 显示对话历史</span>
                    <ToggleSwitch
                        checked={showChatHistoryLauncher}
                        onChange={() => {
                            setShowChatHistoryLauncher(!showChatHistoryLauncher);
                            handleVisibilityChange('pet-show-chathistory', !showChatHistoryLauncher, 'chat-history-visibility');
                        }}
                    />
                </div>
            </div>

            {/* AI 智能对话 */}
            <div className="section-header">AI 智能对话</div>
            <div className="settings-card">
                <div className="switch-item">
                    <span className="switch-label">🤖 启用 AI 对话</span>
                    <ToggleSwitch
                        checked={aiConfig.enabled}
                        onChange={handleAIEnabledToggle}
                    />
                </div>
                {aiConfig.enabled && (
                    <div className="ai-config-body">
                        {/* 提供商选择 */}
                        <div className="ai-provider-row">
                            <button
                                className={`ai-provider-btn ${aiConfig.provider === 'local' ? 'active' : ''}`}
                                onClick={() => handleAIProviderChange('local')}
                            >
                                🏠 本地 Ollama
                            </button>
                            <button
                                className={`ai-provider-btn ${aiConfig.provider === 'third_party' ? 'active' : ''}`}
                                onClick={() => handleAIProviderChange('third_party')}
                            >
                                ☁️ 第三方 API
                            </button>
                            <button
                                className={`ai-provider-btn ${aiConfig.provider === 'claude_cli' ? 'active' : ''}`}
                                onClick={() => handleAIProviderChange('claude_cli')}
                            >
                                💻 Claude CLI
                            </button>
                        </div>

                        {/* 本地 Ollama 配置 */}
                        {aiConfig.provider === 'local' && (
                            <div className="ai-fields">
                                <div className="ai-field">
                                    <label className="ai-label">Ollama 地址</label>
                                    <input
                                        type="text"
                                        className="ai-input"
                                        value={aiConfig.ollamaUrl}
                                        onChange={e => handleAIConfigChange('ollamaUrl', e.target.value)}
                                        placeholder="http://127.0.0.1:11434"
                                    />
                                </div>
                                <div className="ai-field">
                                    <label className="ai-label">模型</label>
                                    <div className="ai-input-row">
                                        {aiDetectedModels.length > 0 ? (
                                            <select
                                                className="ai-select"
                                                value={aiConfig.ollamaModel}
                                                onChange={e => handleAIConfigChange('ollamaModel', e.target.value)}
                                            >
                                                {aiDetectedModels.map(m => (
                                                    <option key={m} value={m}>{m}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <input
                                                type="text"
                                                className="ai-input"
                                                value={aiConfig.ollamaModel}
                                                onChange={e => handleAIConfigChange('ollamaModel', e.target.value)}
                                                placeholder="qwen2.5:7b"
                                            />
                                        )}
                                        <button
                                            className="ai-detect-btn"
                                            onClick={handleDetectOllama}
                                            disabled={aiDetecting}
                                        >
                                            {aiDetecting ? '检测中...' : '检测'}
                                        </button>
                                    </div>
                                    {aiDetectedModels.length > 0 && (
                                        <div className="ai-hint ai-hint--ok">
                                            已检测到 {aiDetectedModels.length} 个对话模型
                                        </div>
                                    )}
                                    {aiDetectError && (
                                        <div className="ai-hint ai-hint--error">
                                            {aiDetectError}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 第三方 API 配置 */}
                        {aiConfig.provider === 'third_party' && (
                            <div className="ai-fields">
                                <div className="ai-field">
                                    <label className="ai-label">API 地址</label>
                                    <input
                                        type="text"
                                        className="ai-input"
                                        value={aiConfig.apiUrl}
                                        onChange={e => handleAIConfigChange('apiUrl', e.target.value)}
                                        placeholder="https://api.openai.com/v1"
                                    />
                                </div>
                                <div className="ai-field">
                                    <label className="ai-label">API Key</label>
                                    <div className="ai-input-row">
                                        <input
                                            type={showApiKey ? 'text' : 'password'}
                                            className="ai-input"
                                            value={aiConfig.apiKey}
                                            onChange={e => handleAIConfigChange('apiKey', e.target.value)}
                                            placeholder="sk-..."
                                        />
                                        <button
                                            className="ai-toggle-key"
                                            onClick={() => setShowApiKey(!showApiKey)}
                                        >
                                            {showApiKey ? '🙈' : '👁'}
                                        </button>
                                    </div>
                                </div>
                                <div className="ai-field">
                                    <label className="ai-label">模型名称</label>
                                    <input
                                        type="text"
                                        className="ai-input"
                                        value={aiConfig.model}
                                        onChange={e => handleAIConfigChange('model', e.target.value)}
                                        placeholder="gpt-4o-mini"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Claude CLI 配置 */}
                        {aiConfig.provider === 'claude_cli' && (
                            <div className="ai-fields">
                                <div className="ai-field">
                                    <label className="ai-label">CLI 路径</label>
                                    <input
                                        type="text"
                                        className="ai-input"
                                        value={aiConfig.claudeCLIPath}
                                        onChange={e => handleAIConfigChange('claudeCLIPath', e.target.value)}
                                        placeholder="claude"
                                    />
                                </div>
                                <div className="ai-hint">
                                    使用本地安装的 Claude Code CLI（已检测到 v2.1.150）
                                </div>
                            </div>
                        )}

                        {/* 人格提示词（所有提供商共用） */}
                        <div className="ai-fields">
                            <div className="ai-field">
                                <label className="ai-label">人格提示词（System）</label>
                                <textarea
                                    className="ai-textarea"
                                    value={aiConfig.systemPrompt}
                                    onChange={e => handleAIConfigChange('systemPrompt', e.target.value)}
                                    placeholder={getCharacterSystemPrompt() || DEFAULT_SYSTEM_PROMPT}
                                    rows={4}
                                />
                                <div className="ai-hint">
                                    {aiConfig.systemPrompt.trim()
                                        ? '当前使用下方自定义人格（覆盖角色卡）'
                                        : getCharacterSystemPrompt()
                                            ? '留空则使用 .local/natori.modelfile 中的 Natori 人格'
                                            : '留空则使用默认桌宠人格；可复制 config/character/ 示例到 .local/'}
                                    {getCharacterSourceHint() && !aiConfig.systemPrompt.trim() && (
                                        <span className="ai-hint--ok"> · 角色卡已加载</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 测试连接 */}
                        <button
                            className="ai-test-btn"
                            onClick={handleTestAI}
                            disabled={aiTesting}
                        >
                            {aiTesting
                                ? (aiConfig.provider === 'local' ? '⏳ 测试中（首次加载可能较慢）...' : '⏳ 测试中...')
                                : '🔌 测试连接'}
                        </button>
                        {aiTestResult && (
                            <div className={`ai-test-result ${aiTestResult.ok ? 'ok' : 'fail'}`}>
                                {aiTestResult.ok ? '✅' : '❌'} {aiTestResult.message}
                            </div>
                        )}
                    </div>
                )}
            </div>
            <div className="section-header">应用</div>
            <div className="settings-card">
                <button className="quit-btn" onClick={handleQuit}>
                    {t('common.quit')}
                </button>
            </div>
        </div>
    );
}

export default SettingsApp;
