/**
 * 皮肤布局：窗口基准尺寸 + 模型在画布内的自适应缩放
 */

const WINDOW_SCALE_KEY = 'pet-window-scale';

export interface SkinLayoutConfig {
  /** 基准窗口宽（scale=1 时） */
  windowWidth: number;
  /** 基准窗口高 */
  windowHeight: number;
  /** 在自动适配基础上的微调倍率 */
  modelScale: number;
  anchor: [number, number];
  offsetX: number;
  offsetY: number;
  /** 模型占画布宽/高的最大比例 (0~1) */
  fill: number;
}

export interface SkinManifestLike {
  size?: { width?: number; height?: number };
  layout?: { fill?: number };
  model?: {
    scale?: number;
    anchor?: [number, number];
    offsetX?: number;
    offsetY?: number;
  };
}

export function parseSkinLayout(manifest: SkinManifestLike): SkinLayoutConfig {
  return {
    windowWidth: manifest.size?.width ?? 400,
    windowHeight: manifest.size?.height ?? 520,
    modelScale: manifest.model?.scale ?? 1,
    anchor: manifest.model?.anchor ?? [0.5, 1],
    offsetX: manifest.model?.offsetX ?? 0,
    offsetY: manifest.model?.offsetY ?? 0,
    fill: manifest.layout?.fill ?? 0.9,
  };
}

export function getWindowScale(): number {
  try {
    const raw = localStorage.getItem(WINDOW_SCALE_KEY);
    if (raw) {
      const n = parseFloat(raw);
      if (Number.isFinite(n) && n >= 0.75 && n <= 2) return n;
    }
  } catch { /* ignore */ }
  return 1;
}

export function setWindowScale(scale: number): void {
  const clamped = Math.min(2, Math.max(0.75, scale));
  localStorage.setItem(WINDOW_SCALE_KEY, String(clamped));
}

export function getScaledWindowSize(layout: SkinLayoutConfig): {
  width: number;
  height: number;
  base: { width: number; height: number };
} {
  const scale = getWindowScale();
  return {
    width: Math.round(layout.windowWidth * scale),
    height: Math.round(layout.windowHeight * scale),
    base: { width: layout.windowWidth, height: layout.windowHeight },
  };
}

export interface SkinLayoutModelLike {
  scale: { set: (v: number) => void; x?: number };
  anchor: { set: (x: number, y: number) => void };
  x: number;
  y: number;
  getLocalBounds?: () => { x: number; y: number; width: number; height: number };
  internalModel?: {
    width: number;
    height: number;
  };
}

/** 角色在画布内的可视区域（用于气泡锚点） */
export interface PetVisualBounds {
  centerX: number;
  headTop: number;
  feetBottom: number;
  width: number;
  height: number;
}

function getModelScaleX(model: SkinLayoutModelLike): number {
  const sx = model.scale.x;
  return typeof sx === 'number' && sx > 0 ? sx : 1;
}

/** Live2D 的 getLocalBounds 在首帧前常异常偏大，用 internalModel 画布尺寸更可靠 */
function measureModelCanvas(model: SkinLayoutModelLike): { width: number; height: number } {
  const im = model.internalModel;
  if (im && im.width > 0 && im.height > 0) {
    return { width: im.width, height: im.height };
  }
  return { width: 1000, height: 1000 };
}

function isSensibleVisualBounds(
  bounds: { width: number; height: number },
  refW: number,
  refH: number,
): boolean {
  return bounds.width > 10
    && bounds.height > 10
    && bounds.width <= refW * 1.5
    && bounds.height <= refH * 1.5;
}

/** 根据画布尺寸与 manifest 布局参数放置 Live2D 模型 */
export function applyModelLayout(
  model: SkinLayoutModelLike,
  layout: SkinLayoutConfig,
  canvasW: number,
  canvasH: number,
): void {
  const { width: refW, height: refH } = measureModelCanvas(model);

  model.scale.set(1);
  const rawBounds = model.getLocalBounds?.() ?? { width: 0, height: 0, x: 0, y: 0 };
  const useVisual = isSensibleVisualBounds(rawBounds, refW, refH);

  const fitScale = (useVisual
    ? Math.min(
      (canvasW * layout.fill) / rawBounds.width,
      (canvasH * layout.fill) / rawBounds.height,
    )
    : Math.min(
      (canvasW * layout.fill) / refW,
      (canvasH * layout.fill) / refH,
    )) * layout.modelScale;

  model.scale.set(fitScale);

  if (useVisual && model.getLocalBounds) {
    const bounds = model.getLocalBounds();
    // 按实际绘制区域对齐脚底，避免 Live2D 画布留白导致“悬空/截脚”
    model.anchor.set(0, 0);
    model.x = canvasW / 2 + layout.offsetX - (bounds.x + bounds.width / 2) * fitScale;
    model.y = canvasH + layout.offsetY - (bounds.y + bounds.height) * fitScale;
    return;
  }

  model.anchor.set(layout.anchor[0], layout.anchor[1]);
  model.x = canvasW * layout.anchor[0] + layout.offsetX;
  model.y = canvasH * layout.anchor[1] + layout.offsetY;
}

/** 根据当前模型布局计算可视边界（画布坐标系） */
export function computePetVisualBounds(
  model: SkinLayoutModelLike,
  canvasW: number,
  canvasH: number,
): PetVisualBounds | null {
  if (!model.getLocalBounds) return null;

  const scale = getModelScaleX(model);
  const bounds = model.getLocalBounds();
  if (!(bounds.width > 10 && bounds.height > 10)) return null;

  const left = model.x + bounds.x * scale;
  const top = model.y + bounds.y * scale;
  const width = bounds.width * scale;
  const height = bounds.height * scale;

  return {
    centerX: left + width / 2,
    headTop: top,
    feetBottom: top + height,
    width,
    height,
  };
}
