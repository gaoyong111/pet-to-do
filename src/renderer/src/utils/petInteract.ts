/**
 * 左键互动逻辑
 *
 * 视觉反馈走 Live2DSkinSetter.applyReaction（动作层，不依赖状态机）。
 * 状态机联动（如 tap → happy → 恢复 idle）待状态优先级与 transient 状态设计完成后再接；
 * 可在 manifest reactionMapping 预留 state 字段统一接入。
 */

import { getRandomDialogue } from '../i18n';

/** 连点冷却（毫秒） */
export const PET_INTERACT_COOLDOWN_MS = 800;

/** 左键随机互动优先使用的 reaction（不含 angry 等强情绪） */
const PREFERRED_REACTIONS = ['pat', 'poke', 'tap'];

export interface PetManifestInteract {
  supportedReactions?: string[];
  reactionMapping?: Record<string, { bubble?: string; motion?: string }>;
}

export interface PetInteractPayload {
  reaction: string;
  bubbleText: string;
}

/**
 * 从 manifest 中随机选取一条可执行的互动 reaction
 */
export function pickInteractReaction(manifest: PetManifestInteract | null): string {
  const mapping = manifest?.reactionMapping || {};
  const supported = manifest?.supportedReactions || [];

  const pool = PREFERRED_REACTIONS.filter(
    (r) => supported.includes(r) && mapping[r]?.motion
  );
  if (pool.length > 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const anyMapped = supported.filter((r) => mapping[r]?.motion);
  if (anyMapped.length > 0) {
    return anyMapped[Math.floor(Math.random() * anyMapped.length)];
  }

  if (supported.length > 0) {
    return supported[Math.floor(Math.random() * supported.length)];
  }

  return 'pat';
}

/**
 * 解析气泡文案：manifest 与 i18n 各半，增加变化
 */
export function resolveInteractBubble(
  manifest: PetManifestInteract | null,
  reaction: string
): string {
  const manifestBubble = manifest?.reactionMapping?.[reaction]?.bubble?.trim();

  const i18nBubble =
    getRandomDialogue(`reaction.${reaction}`) ||
    getRandomDialogue('tap') ||
    getRandomDialogue('idle');

  if (manifestBubble && Math.random() < 0.5) {
    return manifestBubble;
  }

  return i18nBubble || manifestBubble || '…';
}
