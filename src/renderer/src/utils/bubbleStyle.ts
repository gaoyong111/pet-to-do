/**
 * 聊天气泡样式：全局配置 + 主题预设 + CSS 变量
 */

export const BUBBLE_STYLE_KEY = 'pet-bubble-style';
export const BUBBLE_STYLE_SYNC_EVENT = 'pet-bubble-style-sync';

export type BubbleTheme = 'soft' | 'comic' | 'glass' | 'minimal' | 'pastel' | 'custom';
export type BubbleTextAlign = 'left' | 'center' | 'right';

export interface BubbleTypeColors {
  bg: string;
  border: string;
  text: string;
}

export interface BubbleStyleConfig {
  theme: BubbleTheme;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  textAlign: BubbleTextAlign;
  maxWidth: number;
  maxTextHeight: number;
  paddingX: number;
  paddingY: number;
  borderRadius: number;
  borderWidth: number;
  shadowBlur: number;
  shadowY: number;
  shadowOpacity: number;
  backdropBlur: number;
  opacity: number;
  enableFloat: boolean;
  floatAmplitude: number;
  showTail: boolean;
  tailSize: number;
  gapAboveHead: number;
  offsetX: number;
  offsetY: number;
  colors: {
    emotion: BubbleTypeColors;
    info: BubbleTypeColors;
    system: BubbleTypeColors;
    reminder: BubbleTypeColors;
    todo: BubbleTypeColors;
  };
}

const TYPE_COLORS_SOFT: BubbleStyleConfig['colors'] = {
  emotion: { bg: '#fff8c8', border: '#ffd84a', text: '#4a3d00' },
  info: { bg: '#e4f0ff', border: '#8eb8ff', text: '#1a3a6e' },
  system: { bg: '#f0f0f2', border: '#c8cad0', text: '#44464f' },
  reminder: { bg: '#fff0dc', border: '#ffaa55', text: '#7a3a00' },
  todo: { bg: '#e5f9ed', border: '#5fd088', text: '#1a5e36' },
};

const TYPE_COLORS_COMIC: BubbleStyleConfig['colors'] = {
  emotion: { bg: '#fff176', border: '#212121', text: '#212121' },
  info: { bg: '#81d4fa', border: '#212121', text: '#0d2b40' },
  system: { bg: '#eeeeee', border: '#212121', text: '#333333' },
  reminder: { bg: '#ffab91', border: '#212121', text: '#4e1200' },
  todo: { bg: '#a5d6a7', border: '#212121', text: '#1b5e20' },
};

const TYPE_COLORS_GLASS: BubbleStyleConfig['colors'] = {
  emotion: { bg: 'rgba(255, 248, 200, 0.72)', border: 'rgba(255, 200, 80, 0.45)', text: '#3d3200' },
  info: { bg: 'rgba(220, 235, 255, 0.72)', border: 'rgba(120, 170, 255, 0.45)', text: '#1a3560' },
  system: { bg: 'rgba(240, 240, 245, 0.72)', border: 'rgba(180, 185, 195, 0.45)', text: '#404248' },
  reminder: { bg: 'rgba(255, 235, 210, 0.78)', border: 'rgba(255, 150, 60, 0.5)', text: '#6b3200' },
  todo: { bg: 'rgba(220, 248, 230, 0.78)', border: 'rgba(70, 190, 110, 0.45)', text: '#1a5030' },
};

const TYPE_COLORS_MINIMAL: BubbleStyleConfig['colors'] = {
  emotion: { bg: '#ffffff', border: '#e8e8ec', text: '#333333' },
  info: { bg: '#ffffff', border: '#dce8ff', text: '#2a4a7a' },
  system: { bg: '#fafafa', border: '#e0e0e0', text: '#555555' },
  reminder: { bg: '#ffffff', border: '#ffe0c0', text: '#8a4000' },
  todo: { bg: '#ffffff', border: '#d0f0dc', text: '#2a6040' },
};

const TYPE_COLORS_PASTEL: BubbleStyleConfig['colors'] = {
  emotion: { bg: '#fff9e6', border: '#ffe8a3', text: '#5c4d20' },
  info: { bg: '#eef6ff', border: '#c5dcff', text: '#3d5a80' },
  system: { bg: '#f5f5f8', border: '#dddde8', text: '#5a5a68' },
  reminder: { bg: '#fff5eb', border: '#ffd0a8', text: '#8a5020' },
  todo: { bg: '#edfbf3', border: '#b8ebd0', text: '#2d6b45' },
};

export const BUBBLE_THEME_OPTIONS: { id: BubbleTheme; label: string }[] = [
  { id: 'soft', label: '柔和（默认）' },
  { id: 'pastel', label: '粉彩' },
  { id: 'glass', label: '毛玻璃' },
  { id: 'comic', label: '漫画风' },
  { id: 'minimal', label: '极简' },
  { id: 'custom', label: '自定义配色' },
];

export const DEFAULT_BUBBLE_STYLE: BubbleStyleConfig = {
  theme: 'soft',
  fontSize: 13,
  fontWeight: 500,
  lineHeight: 1.5,
  textAlign: 'center',
  maxWidth: 280,
  maxTextHeight: 120,
  paddingX: 14,
  paddingY: 10,
  borderRadius: 16,
  borderWidth: 1,
  shadowBlur: 20,
  shadowY: 8,
  shadowOpacity: 0.16,
  backdropBlur: 0,
  opacity: 0.98,
  enableFloat: true,
  floatAmplitude: 4,
  showTail: true,
  tailSize: 9,
  gapAboveHead: 10,
  offsetX: 0,
  offsetY: 0,
  colors: structuredClone(TYPE_COLORS_SOFT),
};

function themeColors(theme: BubbleTheme): BubbleStyleConfig['colors'] {
  switch (theme) {
    case 'comic': return structuredClone(TYPE_COLORS_COMIC);
    case 'glass': return structuredClone(TYPE_COLORS_GLASS);
    case 'minimal': return structuredClone(TYPE_COLORS_MINIMAL);
    case 'pastel': return structuredClone(TYPE_COLORS_PASTEL);
    case 'custom':
    case 'soft':
    default:
      return structuredClone(TYPE_COLORS_SOFT);
  }
}

function clampStyle(config: BubbleStyleConfig): BubbleStyleConfig {
  return {
    ...config,
    fontSize: Math.min(18, Math.max(11, config.fontSize)),
    fontWeight: Math.min(700, Math.max(400, config.fontWeight)),
    lineHeight: Math.min(1.9, Math.max(1.2, config.lineHeight)),
    maxWidth: Math.min(360, Math.max(160, config.maxWidth)),
    maxTextHeight: Math.min(220, Math.max(60, config.maxTextHeight)),
    paddingX: Math.min(28, Math.max(8, config.paddingX)),
    paddingY: Math.min(24, Math.max(6, config.paddingY)),
    borderRadius: Math.min(28, Math.max(6, config.borderRadius)),
    borderWidth: Math.min(3, Math.max(0, config.borderWidth)),
    shadowBlur: Math.min(40, Math.max(0, config.shadowBlur)),
    shadowY: Math.min(20, Math.max(0, config.shadowY)),
    shadowOpacity: Math.min(0.45, Math.max(0, config.shadowOpacity)),
    backdropBlur: Math.min(24, Math.max(0, config.backdropBlur)),
    opacity: Math.min(1, Math.max(0.65, config.opacity)),
    floatAmplitude: Math.min(10, Math.max(0, config.floatAmplitude)),
    tailSize: Math.min(14, Math.max(4, config.tailSize)),
    gapAboveHead: Math.min(80, Math.max(-20, config.gapAboveHead)),
    offsetX: Math.min(120, Math.max(-120, config.offsetX)),
    offsetY: Math.min(120, Math.max(-120, config.offsetY)),
  };
}

export function loadBubbleStyle(): BubbleStyleConfig {
  try {
    const raw = localStorage.getItem(BUBBLE_STYLE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<BubbleStyleConfig>;
      const merged = {
        ...DEFAULT_BUBBLE_STYLE,
        ...parsed,
        colors: {
          ...DEFAULT_BUBBLE_STYLE.colors,
          ...(parsed.colors ?? {}),
        },
      };
      if (merged.theme !== 'custom' && parsed.theme && parsed.theme !== merged.theme) {
        merged.colors = themeColors(merged.theme);
      }
      return clampStyle(merged);
    }
  } catch { /* ignore */ }
  return clampStyle(structuredClone(DEFAULT_BUBBLE_STYLE));
}

export function saveBubbleStyle(patch: Partial<BubbleStyleConfig>): BubbleStyleConfig {
  const prev = loadBubbleStyle();
  let next: BubbleStyleConfig = {
    ...prev,
    ...patch,
    colors: patch.colors ? { ...prev.colors, ...patch.colors } : prev.colors,
  };

  if (patch.theme && patch.theme !== 'custom') {
    next.colors = themeColors(patch.theme);
  }

  next = clampStyle(next);
  localStorage.setItem(BUBBLE_STYLE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(BUBBLE_STYLE_SYNC_EVENT));
  return next;
}

export function resetBubbleStyle(): BubbleStyleConfig {
  localStorage.removeItem(BUBBLE_STYLE_KEY);
  window.dispatchEvent(new CustomEvent(BUBBLE_STYLE_SYNC_EVENT));
  return clampStyle(structuredClone(DEFAULT_BUBBLE_STYLE));
}

export function bubbleStyleToCssVars(style: BubbleStyleConfig): Record<string, string> {
  const shadow = style.shadowBlur > 0
    ? `0 ${style.shadowY}px ${style.shadowBlur}px rgba(0,0,0,${style.shadowOpacity})`
    : 'none';

  return {
    '--bubble-font-size': `${style.fontSize}px`,
    '--bubble-font-weight': String(style.fontWeight),
    '--bubble-line-height': String(style.lineHeight),
    '--bubble-text-align': style.textAlign,
    '--bubble-max-width': `${style.maxWidth}px`,
    '--bubble-max-text-height': `${style.maxTextHeight}px`,
    '--bubble-padding-x': `${style.paddingX}px`,
    '--bubble-padding-y': `${style.paddingY}px`,
    '--bubble-radius': `${style.borderRadius}px`,
    '--bubble-border-width': `${style.borderWidth}px`,
    '--bubble-shadow': shadow,
    '--bubble-backdrop': style.backdropBlur > 0 ? `blur(${style.backdropBlur}px)` : 'none',
    '--bubble-opacity': String(style.opacity),
    '--bubble-float-amp': `${style.floatAmplitude}px`,
    '--bubble-tail-size': `${style.tailSize}px`,
    '--bubble-emotion-bg': style.colors.emotion.bg,
    '--bubble-emotion-border': style.colors.emotion.border,
    '--bubble-emotion-text': style.colors.emotion.text,
    '--bubble-info-bg': style.colors.info.bg,
    '--bubble-info-border': style.colors.info.border,
    '--bubble-info-text': style.colors.info.text,
    '--bubble-system-bg': style.colors.system.bg,
    '--bubble-system-border': style.colors.system.border,
    '--bubble-system-text': style.colors.system.text,
    '--bubble-reminder-bg': style.colors.reminder.bg,
    '--bubble-reminder-border': style.colors.reminder.border,
    '--bubble-reminder-text': style.colors.reminder.text,
    '--bubble-todo-bg': style.colors.todo.bg,
    '--bubble-todo-border': style.colors.todo.border,
    '--bubble-todo-text': style.colors.todo.text,
  };
}

export function initBubbleStyleSync(onChange: () => void): () => void {
  const onCustom = () => onChange();
  const onStorage = (e: StorageEvent) => {
    if (e.key === BUBBLE_STYLE_KEY) onChange();
  };
  window.addEventListener(BUBBLE_STYLE_SYNC_EVENT, onCustom);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(BUBBLE_STYLE_SYNC_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
  };
}

export type BubbleColorType = keyof BubbleStyleConfig['colors'];

export const BUBBLE_COLOR_TYPE_LABELS: Record<BubbleColorType, string> = {
  emotion: '情感 / 对话',
  info: '信息',
  system: '系统',
  reminder: '提醒',
  todo: '任务',
};
