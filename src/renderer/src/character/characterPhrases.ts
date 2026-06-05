/**
 * 本地角色卡（.local/natori.modelfile + natori.phrases.json）
 * 由主进程加载，渲染进程缓存
 */

import type { Locale } from '../i18n';

export interface CharacterPhrasesFile {
  locale: string;
  greeting?: Record<string, string[]>;
  dialogue?: Record<string, unknown>;
}

export interface CharacterBundle {
  systemPrompt: string | null;
  phrases: CharacterPhrasesFile | null;
  sourceDir: string | null;
}

let bundle: CharacterBundle | null = null;

export function setCharacterBundle(next: CharacterBundle | null): void {
  bundle = next;
}

export async function initCharacter(): Promise<void> {
  if (!window.petAPI?.getCharacterBundle) return;
  try {
    const loaded = await window.petAPI.getCharacterBundle();
    setCharacterBundle(loaded);
    if (loaded.sourceDir) {
      console.info('[character] 已加载本地角色:', loaded.sourceDir);
    }
  } catch (err) {
    console.warn('[character] 加载失败:', err);
  }
}

export function getCharacterSystemPrompt(): string | null {
  return bundle?.systemPrompt?.trim() || null;
}

export function getCharacterSourceHint(): string | null {
  if (!bundle?.sourceDir) return null;
  return bundle.sourceDir;
}

function pickFromPool(pool: unknown): string | null {
  if (!Array.isArray(pool) || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)] as string;
}

function pickByPath(root: unknown, path: string): string | null {
  const keys = path.split('.');
  let value: unknown = root;
  for (const key of keys) {
    if (!value || typeof value !== 'object' || !(key in (value as object))) {
      return null;
    }
    value = (value as Record<string, unknown>)[key];
  }
  return pickFromPool(value);
}

/** 从角色短语池取一句（locale 不匹配时返回 null，走 i18n 默认） */
export function getCharacterPhrase(category: string, locale: Locale): string | null {
  const phrases = bundle?.phrases;
  if (!phrases || phrases.locale !== locale) return null;
  return pickByPath(phrases.dialogue, category);
}

/** 从角色问候池取一句 */
export function getCharacterGreeting(period: 'morning' | 'noon' | 'afternoon' | 'evening' | 'night', locale: Locale): string | null {
  const phrases = bundle?.phrases;
  if (!phrases || phrases.locale !== locale) return null;
  return pickFromPool(phrases.greeting?.[period]);
}
