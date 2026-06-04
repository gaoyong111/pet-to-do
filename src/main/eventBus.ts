import { EventEmitter } from 'events';

/** 桌宠状态类型 — 皮肤自行声明，不硬编码 */
export type PetState = string;

/** 桌宠情绪类型 */
export type PetEmotion = 'normal' | 'confused' | 'surprised' | 'excited' | 'angry' | 'thinking' | 'shy';

/** 气泡操作按钮 */
export interface BubbleAction {
    label: string;
    action: string;
    style?: 'primary' | 'secondary' | 'danger';
}

/** 气泡消息接口 */
export interface BubbleMessage {
    /** 消息内容 */
    text: string;
    /** 显示时长（毫秒），0 表示不自动消失 */
    duration: number;
    /** 消息类型，影响气泡样式 */
    type: 'emotion' | 'info' | 'system' | 'reminder' | 'todo';
    /** 操作按钮（可选） */
    actions?: BubbleAction[];
    /** 关联的提醒ID（可选） */
    reminderId?: string;
}

/** 事件类型枚举 */
export interface PetEvents {
    /** 状态变化 */
    'state-change': (newState: PetState, oldState: PetState) => void;
    /** 情绪变化 */
    'emotion-change': (newEmotion: PetEmotion, oldEmotion: PetEmotion) => void;
    /** 显示气泡 */
    'show-bubble': (message: BubbleMessage) => void;
    /** 隐藏气泡 */
    'hide-bubble': () => void;
    /** 播放交互反应动画 */
    'play-reaction': (reaction: string) => void;
}

/**
 * 桌宠事件总线
 * 主进程的核心枢纽，所有事件源（时间、用户操作、外部工具、AI）
 * 都通过事件总线驱动宠物行为
 *
 * 事件流：事件源 → emit → ipc 转发 → 渲染进程响应
 */
class PetEventBus extends EventEmitter {
    /** 当前桌宠状态 */
    private state: PetState = 'idle';

    /** 当前桌宠情绪 */
    private emotion: PetEmotion = 'normal';

    /**
     * 获取当前状态
     * @returns 当前桌宠状态
     */
    getState(): PetState {
        return this.state;
    }

    /**
     * 获取当前情绪
     * @returns 当前桌宠情绪
     */
    getEmotion(): PetEmotion {
        return this.emotion;
    }

    /**
     * 切换桌宠状态
     * 仅在状态变化时触发事件
     * @param newState - 目标状态
     */
    setState(newState: PetState): void {
        const oldState = this.state;
        if (oldState === newState) return;

        this.state = newState;
        this.emit('state-change', newState, oldState);
    }

    /**
     * 强制设置状态并触发事件
     * 无论状态是否变化都会触发事件
     * @param newState - 目标状态
     */
    forceSetState(newState: PetState): void {
        const oldState = this.state;
        this.state = newState;
        this.emit('state-change', newState, oldState);
    }

    /**
     * 切换桌宠情绪
     * 仅在情绪变化时触发事件
     * @param newEmotion - 目标情绪
     */
    setEmotion(newEmotion: PetEmotion): void {
        const oldEmotion = this.emotion;
        if (oldEmotion === newEmotion) return;

        this.emotion = newEmotion;
        this.emit('emotion-change', newEmotion, oldEmotion);
    }

    /**
     * 强制设置情绪并触发事件
     * 无论情绪是否变化都会触发事件
     * @param newEmotion - 目标情绪
     */
    forceSetEmotion(newEmotion: PetEmotion): void {
        const oldEmotion = this.emotion;
        this.emotion = newEmotion;
        this.emit('emotion-change', newEmotion, oldEmotion);
    }

    /**
     * 显示气泡消息
     * @param text - 消息内容
     * @param duration - 显示时长（毫秒），默认 3000
     * @param type - 消息类型，默认 'emotion'
     */
    showBubble(text: string, duration: number = 3000, type: BubbleMessage['type'] = 'emotion'): void {
        const message: BubbleMessage = { text, duration, type };
        this.emit('show-bubble', message);
    }

    /**
     * 显示提醒气泡（带知道了/稍后提醒/完成任务操作按钮）
     * @param text - 提醒内容
     * @param reminderId - 提醒ID
     * @param taskId - 关联的任务ID（可选，用于完成任务）
     */
    showReminderBubble(text: string, reminderId: string, taskId?: string): void {
        const actions: BubbleAction[] = [];
        
        // 如果有关联任务，添加完成任务按钮
        if (taskId) {
            actions.push({ label: '完成 ✓', action: `complete_${taskId}`, style: 'primary' });
        }
        
        actions.push(
            { label: '15分钟后', action: 'snooze_15', style: 'secondary' },
            { label: '1小时后', action: 'snooze_60', style: 'secondary' }
        );
        
        // 如果没有任务ID，添加"知道了"按钮
        if (!taskId) {
            actions.unshift({ label: '知道了 ✓', action: 'dismiss', style: 'primary' });
        }
        
        const message: BubbleMessage = {
            text,
            duration: 0,
            type: 'reminder',
            reminderId,
            actions
        };
        this.emit('show-bubble', message);
    }

    /**
     * 隐藏气泡
     */
    hideBubble(): void {
        this.emit('hide-bubble');
    }

    /**
     * 触发交互反应动画
     * @param reaction - 反应名称（如 'pat', 'poke'）
     */
    playReaction(reaction: string): void {
        this.emit('play-reaction', reaction);
    }
}

/** 全局事件总线单例 */
export const petEventBus = new PetEventBus();
