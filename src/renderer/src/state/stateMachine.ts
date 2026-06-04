import { PetState, PetEmotion } from '../types';

/** 状态变化回调函数类型 */
type StateChangeCallback = (newState: PetState, oldState: PetState) => void;

/** 情绪变化回调函数类型 */
type EmotionChangeCallback = (newEmotion: PetEmotion, oldEmotion: PetEmotion) => void;

/**
 * 桌宠状态机
 * 管理桌宠的状态转换、情绪管理和变化通知
 */
class StateMachine {
    /** 当前状态 */
    private currentState: PetState;

    /** 当前情绪 */
    private currentEmotion: PetEmotion;

    /** 状态变化订阅者列表 */
    private stateSubscribers: StateChangeCallback[];

    /** 情绪变化订阅者列表 */
    private emotionSubscribers: EmotionChangeCallback[];

    /**
     * 创建状态机实例
     * @param initialState - 初始状态，默认为 'idle'
     * @param initialEmotion - 初始情绪，默认为 'normal'
     */
    constructor(initialState: PetState = 'idle', initialEmotion: PetEmotion = 'normal') {
        this.currentState = initialState;
        this.currentEmotion = initialEmotion;
        this.stateSubscribers = [];
        this.emotionSubscribers = [];
    }

    /**
     * 获取当前状态
     * @returns 当前状态
     */
    getCurrentState(): PetState {
        return this.currentState;
    }

    /**
     * 获取当前情绪
     * @returns 当前情绪
     */
    getCurrentEmotion(): PetEmotion {
        return this.currentEmotion;
    }

    /**
     * 执行状态转换
     * 皮肤自行声明支持的状态，状态机不限制
     * @param newState - 目标状态
     * @returns 转换后的新状态
     */
    transition(newState: PetState): PetState {
        const oldState = this.currentState;
        this.currentState = newState;

        // 通知所有状态订阅者
        this.stateSubscribers.forEach((callback) => {
            callback(newState, oldState);
        });

        return this.currentState;
    }

    /**
     * 设置情绪
     * @param newEmotion - 目标情绪
     * @returns 转换后的新情绪
     * @throws 当 newEmotion 不是合法的 PetEmotion 时抛出错误
     */
    setEmotion(newEmotion: PetEmotion): PetEmotion {
        const validEmotions: PetEmotion[] = ['normal', 'confused', 'surprised', 'excited', 'angry', 'thinking', 'shy'];
        if (!validEmotions.includes(newEmotion)) {
            throw new Error(`Invalid emotion: ${newEmotion}`);
        }

        const oldEmotion = this.currentEmotion;
        this.currentEmotion = newEmotion;

        // 通知所有情绪订阅者
        this.emotionSubscribers.forEach((callback) => {
            callback(newEmotion, oldEmotion);
        });

        return this.currentEmotion;
    }

    /**
     * 重置情绪为正常状态
     */
    resetEmotion(): void {
        this.setEmotion('normal');
    }

    /**
     * 订阅状态变化
     * @param callback - 状态变化时的回调函数
     * @returns 取消订阅的函数
     */
    subscribeState(callback: StateChangeCallback): () => void {
        this.stateSubscribers.push(callback);

        // 返回取消订阅函数
        return () => {
            this.stateSubscribers = this.stateSubscribers.filter((cb) => cb !== callback);
        };
    }

    /**
     * 订阅情绪变化
     * @param callback - 情绪变化时的回调函数
     * @returns 取消订阅的函数
     */
    subscribeEmotion(callback: EmotionChangeCallback): () => void {
        this.emotionSubscribers.push(callback);

        // 返回取消订阅函数
        return () => {
            this.emotionSubscribers = this.emotionSubscribers.filter((cb) => cb !== callback);
        };
    }

    /**
     * 订阅状态变化（向后兼容）
     * @param callback - 状态变化时的回调函数
     * @returns 取消订阅的函数
     */
    subscribe(callback: StateChangeCallback): () => void {
        return this.subscribeState(callback);
    }
}

export { StateMachine };
export type { StateChangeCallback, EmotionChangeCallback };
