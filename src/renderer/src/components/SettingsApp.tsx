import { useState, useEffect, useCallback } from 'react';
import { PetState } from '../types';
import { getLocale, setLocale, subscribeLocaleChange, getAvailableLocales, Locale, t } from '../i18n';
import './SettingsApp.css';

interface SkinGroup {
    id: string;
    name: string;
    skins: Array<{ id: string; name: string }>;
}

const SKIN_GROUPS: SkinGroup[] = [
    {
        id: 'default',
        name: '默认',
        skins: [
            { id: 'default', name: '默认皮肤' }
        ]
    },
    {
        id: 'cubism',
        name: 'Cubism SDK',
        skins: [
            { id: 'cubism-Hiyori', name: 'Hiyori' },
            { id: 'cubism-Mao', name: 'Mao' },
            { id: 'cubism-Mark', name: 'Mark' },
            { id: 'cubism-Natori', name: 'Natori' },
            { id: 'cubism-Ren', name: 'Ren' },
            { id: 'cubism-Rice', name: 'Rice' },
            { id: 'cubism-Wanko', name: 'Wanko' },
            { id: 'cubism-haru', name: 'Haru' }
        ]
    },
    {
        id: 'azurlane',
        name: '碧蓝航线',
        skins: [
            { id: 'azurlane-z23', name: 'Z23' },
            { id: 'azurlane-z46', name: 'Z46' },
            { id: 'azurlane-lafei', name: '拉菲' },
            { id: 'azurlane-lingbo', name: '凌波' },
            { id: 'azurlane-mingshi', name: '明石' },
            { id: 'azurlane-jian3', name: '剑三' },
            { id: 'azurlane-z13', name: 'Z13' }
        ]
    },
    {
        id: 'girlsfrontline',
        name: '少女前线',
        skins: [
            { id: 'girlsfrontline-armor1', name: 'Armor1' },
            { id: 'girlsfrontline-command1', name: 'Command1' },
            { id: 'girlsfrontline-golden1', name: 'Golden1' },
            { id: 'girlsfrontline-shield1', name: 'Shield1' },
            { id: 'girlsfrontline-target1', name: 'Target1' }
        ]
    },
];

const SUPPORTED_STATES: PetState[] = ['idle', 'working', 'happy', 'sad', 'sleeping', 'shy', 'angry', 'surprised'];

function getStateLabels(): Record<string, string> {
    return {
        idle: t('state.idle'),
        working: t('state.working'),
        happy: t('state.happy'),
        sad: t('state.sad'),
        sleeping: t('state.sleeping'),
        tap: t('state.tap'),
        angry: t('state.angry'),
        shy: t('state.shy'),
        surprised: t('state.surprised')
    };
}

function SettingsApp(): JSX.Element {
    const [currentLocale, setCurrentLocale] = useState<Locale>(getLocale());
    const [currentGroup, setCurrentGroup] = useState(() => localStorage.getItem('pet-skin-group') || 'cubism');
    const [currentSkin, setCurrentSkin] = useState(() => localStorage.getItem('pet-skin-id') || 'cubism-Hiyori');
    const [currentState, setCurrentState] = useState<PetState>(() => {
        const saved = localStorage.getItem('pet-current-state');
        return (saved as PetState) || 'idle';
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

    const stateLabels = getStateLabels();

    const currentGroupData = SKIN_GROUPS.find(group => group.id === currentGroup);
    const currentSkins = currentGroupData?.skins || [];

    useEffect(() => {
        return subscribeLocaleChange((locale: Locale) => {
            setCurrentLocale(locale);
        });
    }, []);

    const handleLocaleChange = useCallback((locale: Locale) => {
        setLocale(locale);
        setCurrentLocale(locale);
    }, []);

    const handleGroupChange = useCallback((groupId: string) => {
        setCurrentGroup(groupId);
        const group = SKIN_GROUPS.find(g => g.id === groupId);
        if (group && group.skins.length > 0) {
            setCurrentSkin(group.skins[0].id);
            localStorage.setItem('pet-skin-group', groupId);
            localStorage.setItem('pet-skin-id', group.skins[0].id);
            if (window.petAPI) {
                window.petAPI.relayToMain('switch-skin', group.skins[0].id);
            }
        }
    }, []);

    const handleSkinChange = useCallback((skinId: string) => {
        setCurrentSkin(skinId);
        localStorage.setItem('pet-skin-id', skinId);
        if (window.petAPI) {
            window.petAPI.relayToMain('switch-skin', skinId);
        }
    }, []);

    const handleStateChange = useCallback((state: PetState) => {
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
                <div className="state-row">
                    {SUPPORTED_STATES.map((state) => (
                        <button
                            key={state}
                            className={`state-pill ${currentState === state ? 'active' : ''}`}
                            onClick={() => handleStateChange(state)}
                        >
                            {stateLabels[state] || state}
                        </button>
                    ))}
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
            </div>

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
            </div>

            {/* 退出 */}
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
