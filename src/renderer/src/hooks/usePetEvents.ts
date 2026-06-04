import { useEffect } from 'react';
import { PetState, PetEmotion } from '../types';
import { StateMachine } from '../state/stateMachine';

/**
 * 监听主进程事件的 Hook
 * 将 IPC 事件桥接到渲染进程的状态机
 *
 * 事件流：主进程事件总线 → IPC → preload → 此 hook → 状态机
 */
function usePetEvents(
    stateMachine: StateMachine,
    onReaction?: (reaction: string) => void
): void {
    /**
     * 监听状态变化事件
     */
    useEffect(() => {
        if (!window.petAPI) return;

        const unsub = window.petAPI.onStateChange((newState: string) => {
            stateMachine.transition(newState);
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
     * 将 IPC 反应事件传递给外部处理器（如 Live2DSkinSetter）
     */
    useEffect(() => {
        if (!window.petAPI) return;

        const unsub = window.petAPI.onPlayReaction((reaction: string) => {
            console.log(`[Pet] Reaction: ${reaction}`);
            onReaction?.(reaction);
        });

        return unsub;
    }, [onReaction]);
}

export default usePetEvents;
