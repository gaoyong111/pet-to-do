/**
 * 皮肤视图布局：按皮肤存 localStorage 覆盖 manifest 默认值
 */

import {
  getWindowScale,
  parseSkinLayout,
  setWindowScale,
  type SkinLayoutConfig,
  type SkinManifestLike,
} from './skinLayout';

export const SKIN_LAYOUT_OVERRIDES_KEY = 'pet-skin-layout-overrides';
export const SKIN_LAYOUT_SYNC_EVENT = 'pet-skin-layout-sync';

/** 用户可手动覆盖的字段（不含 anchor，脚底对齐由布局算法处理） */
export interface SkinLayoutOverride {
  modelScale?: number;
  offsetX?: number;
  offsetY?: number;
  fill?: number;
  windowWidth?: number;
  windowHeight?: number;
  windowScale?: number;
  /** 气泡相对角色锚点的水平偏移（px） */
  bubbleOffsetX?: number;
  /** 气泡相对角色锚点的垂直偏移（px，负=更高） */
  bubbleOffsetY?: number;
  /** 气泡底边与头顶的间距（px） */
  bubbleGapAboveHead?: number;
}

export type SkinLayoutOverrideMap = Record<string, SkinLayoutOverride>;

function clampWindowScale(n: number): number {
  return Math.min(2, Math.max(0.75, n));
}

export function loadSkinLayoutOverrideMap(): SkinLayoutOverrideMap {
  try {
    const raw = localStorage.getItem(SKIN_LAYOUT_OVERRIDES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SkinLayoutOverrideMap;
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch { /* ignore */ }
  return {};
}

export function getSkinLayoutOverride(skinId: string): SkinLayoutOverride | null {
  const map = loadSkinLayoutOverrideMap();
  return map[skinId] ?? null;
}

export function saveSkinLayoutOverride(skinId: string, patch: Partial<SkinLayoutOverride>): void {
  const map = loadSkinLayoutOverrideMap();
  const prev = map[skinId] ?? {};
  const next = { ...prev, ...patch };
  map[skinId] = next;
  localStorage.setItem(SKIN_LAYOUT_OVERRIDES_KEY, JSON.stringify(map));

  if (patch.windowScale !== undefined) {
    setWindowScale(clampWindowScale(patch.windowScale));
  }

  window.dispatchEvent(new CustomEvent(SKIN_LAYOUT_SYNC_EVENT, { detail: { skinId } }));
}

export function clearSkinLayoutOverride(skinId: string): void {
  const map = loadSkinLayoutOverrideMap();
  delete map[skinId];
  localStorage.setItem(SKIN_LAYOUT_OVERRIDES_KEY, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent(SKIN_LAYOUT_SYNC_EVENT, { detail: { skinId } }));
}

export function mergeSkinLayout(manifest: SkinManifestLike, skinId: string): SkinLayoutConfig {
  const base = parseSkinLayout(manifest);
  const ov = getSkinLayoutOverride(skinId);
  if (!ov) return base;

  return {
    ...base,
    modelScale: ov.modelScale ?? base.modelScale,
    offsetX: ov.offsetX ?? base.offsetX,
    offsetY: ov.offsetY ?? base.offsetY,
    fill: ov.fill ?? base.fill,
    windowWidth: ov.windowWidth ?? base.windowWidth,
    windowHeight: ov.windowHeight ?? base.windowHeight,
  };
}

export function getEffectiveWindowScale(skinId: string): number {
  const ov = getSkinLayoutOverride(skinId);
  if (ov?.windowScale !== undefined && Number.isFinite(ov.windowScale)) {
    return clampWindowScale(ov.windowScale);
  }
  return getWindowScale();
}

export function getScaledWindowSizeForSkin(
  layout: SkinLayoutConfig,
  skinId: string,
): {
  width: number;
  height: number;
  base: { width: number; height: number };
} {
  const scale = getEffectiveWindowScale(skinId);
  return {
    width: Math.round(layout.windowWidth * scale),
    height: Math.round(layout.windowHeight * scale),
    base: { width: layout.windowWidth, height: layout.windowHeight },
  };
}

/** 从 manifest + 已有覆盖生成面板初始值 */
export function buildLayoutEditorValues(
  manifest: SkinManifestLike,
  skinId: string,
): Required<SkinLayoutOverride> {
  const base = parseSkinLayout(manifest);
  const ov = getSkinLayoutOverride(skinId) ?? {};
  return {
    modelScale: ov.modelScale ?? base.modelScale,
    offsetX: ov.offsetX ?? base.offsetX,
    offsetY: ov.offsetY ?? base.offsetY,
    fill: ov.fill ?? base.fill,
    windowWidth: ov.windowWidth ?? base.windowWidth,
    windowHeight: ov.windowHeight ?? base.windowHeight,
    windowScale: ov.windowScale ?? getWindowScale(),
    bubbleOffsetX: ov.bubbleOffsetX ?? 0,
    bubbleOffsetY: ov.bubbleOffsetY ?? 0,
    bubbleGapAboveHead: ov.bubbleGapAboveHead ?? 10,
  };
}

export function getSkinBubblePositionAdjust(skinId: string): {
  offsetX: number;
  offsetY: number;
  gapAboveHead: number;
} {
  const ov = getSkinLayoutOverride(skinId);
  return {
    offsetX: ov?.bubbleOffsetX ?? 0,
    offsetY: ov?.bubbleOffsetY ?? 0,
    gapAboveHead: ov?.bubbleGapAboveHead ?? 10,
  };
}

export function initSkinLayoutSync(onChange: (skinId?: string) => void): () => void {
  const onCustom = (e: Event) => {
    const skinId = (e as CustomEvent<{ skinId?: string }>).detail?.skinId;
    onChange(skinId);
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === SKIN_LAYOUT_OVERRIDES_KEY || e.key === 'pet-window-scale') {
      onChange();
    }
  };

  window.addEventListener(SKIN_LAYOUT_SYNC_EVENT, onCustom);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(SKIN_LAYOUT_SYNC_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
  };
}
