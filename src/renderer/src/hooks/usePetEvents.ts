import { useEffect } from 'react';
import { PetState, PetEmotion } from '../types';
import { StateMachine } from '../state/stateMachine';

/**
 * 监听主进程事件的 Hook
 * 将 IPC 事件桥接到渲染进程的状态机
 *
 * 事件流：主进程事件总线 → IPC → preload → 此 hook → 状态机
 */
function usePetEvents(stateMachine: StateMachine): void {
    /**
     * 监听状态变化事件
     */
    useEffect(() => {
        if (!window.petAPI) return;

        const unsub = window.petAPI.onStateChange((newState: string) => {
            const validStates: PetState[] = ['idle', 'working', 'happy', 'sad', 'sleeping'];
            if (validStates.includes(newState as PetState)) {
                stateMachine.transition(newState as PetState);
            }
        });

        return unsub;
    }, [stateMachine]);

    /**
     * 监听情绪变化事件
     */
    useEffect(() => {
        if (!window.petAPI) return;

        const unsub = window.petAPI.onEmotionChange((newEmotion: string) => {
            const validEmotions: PetEmotion[] = ['normal', 'confused', 'surprised', 'excited', 'angry', 'thinking', 'shy'];
            if (validEmotions.includes(newEmotion as PetEmotion)) {
                stateMachine.setEmotion(newEmotion as PetEmotion);
            }
        });

        return unsub;
    }, [stateMachine]);

    /**
     * 监听交互反应事件
     * 目前仅打印日志，后续可扩展为播放独立动画
     */
    useEffect(() => {
        if (!window.petAPI) return;

        const unsub = window.petAPI.onPlayReaction((reaction: string) => {
            console.log(`[Pet] Reaction: ${reaction}`);
        });

        return unsub;
    }, []);
}

export default usePetEvents;
