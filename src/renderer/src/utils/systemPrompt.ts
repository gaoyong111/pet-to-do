import { AIConfig, DEFAULT_AI_CONFIG } from '../types';
import { getCharacterSystemPrompt } from '../character/characterPhrases';

export const DEFAULT_SYSTEM_PROMPT =
  '你是一个桌面宠物伙伴。说话可爱、元气、充满活力。回复简洁（不超过2句话），使用颜文字。当用户让你执行操作时，不需要回复"好的"之类的确认词，直接执行即可。';

export function readSystemPrompt(config?: Pick<AIConfig, 'systemPrompt'>): string {
  const custom = config?.systemPrompt?.trim();
  if (custom) return custom;
  const fromCharacter = getCharacterSystemPrompt();
  if (fromCharacter) return fromCharacter;
  return DEFAULT_SYSTEM_PROMPT;
}

export function loadSystemPromptFromStorage(): string {
  try {
    const saved = localStorage.getItem('pet-ai-config');
    if (saved) {
      const cfg = { ...DEFAULT_AI_CONFIG, ...JSON.parse(saved) } as AIConfig;
      return readSystemPrompt(cfg);
    }
  } catch { /* ignore */ }
  return DEFAULT_SYSTEM_PROMPT;
}
