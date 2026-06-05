import { useEffect, useRef, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display/cubism4';
import { PetEmotion } from '../types';
import { SkinSetterFactory } from './skin-setters/SkinSetterFactory';
import { Live2DSkinSetter } from './skin-setters/Live2DSkinSetter';
import {
  PET_INTERACT_COOLDOWN_MS,
  pickInteractReaction,
  resolveInteractBubble,
  type PetManifestInteract,
} from '../utils/petInteract';
import {
  applyModelLayout,
  computePetVisualBounds,
  type PetVisualBounds,
  type SkinLayoutConfig,
} from '../utils/skinLayout';
import {
  getScaledWindowSizeForSkin,
  mergeSkinLayout,
} from '../utils/skinLayoutOverride';

if (typeof window !== 'undefined') {
  (window as any).PIXI = PIXI;
}

function installRenderGuard(app: PIXI.Application) {
  const guardedRender = () => {
    try { app.render(); }
    catch (error) {
      console.error('[Live2D] Pixi render error.', error);
      app.ticker.stop();
    }
  };
  app.ticker.remove(app.render, app);
  app.ticker.add(guardedRender);
}

export type { PetVisualBounds };

export interface PetSizeChangePayload {
  width: number;
  height: number;
  base: { width: number; height: number };
}

interface Live2DPetProps {
  skinFolder: string;
  layoutVersion?: number;
  onSizeChange?: (payload: PetSizeChangePayload) => void;
  onPetBoundsChange?: (bounds: PetVisualBounds | null) => void;
  onInteract?: (info: { reaction: string; bubbleText: string }) => void;
  onDoubleClick?: () => void;
}

function Live2DPet({ skinFolder, layoutVersion = 0, onSizeChange, onPetBoundsChange, onInteract, onDoubleClick }: Live2DPetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const stageRef = useRef<PIXI.Container | null>(null);
  const modelRef = useRef<Live2DModel | null>(null);
  const skinSetterRef = useRef<Live2DSkinSetter | null>(null);
  const manifestRef = useRef<PetManifestInteract | null>(null);
  const layoutRef = useRef<SkinLayoutConfig | null>(null);
  const onSizeChangeRef = useRef(onSizeChange);
  const onInteractRef = useRef(onInteract);
  const onDoubleClickRef = useRef(onDoubleClick);
  const lastTapAtRef = useRef(0);
  const [, setCurrentState] = useState<string>('idle');
  const [, setCurrentEmotion] = useState<PetEmotion>('normal');

  onSizeChangeRef.current = onSizeChange;
  onInteractRef.current = onInteract;
  onDoubleClickRef.current = onDoubleClick;
  const onPetBoundsChangeRef = useRef(onPetBoundsChange);
  onPetBoundsChangeRef.current = onPetBoundsChange;

  const mousePosRef = useRef({ x: 0.5, y: 0.5 });
  const lastMouseMoveRef = useRef(Date.now());
  const eyeTrackingRAF = useRef<number>(0);

  const reportPetBounds = useCallback(() => {
    const container = containerRef.current;
    if (!container || !modelRef.current) {
      onPetBoundsChangeRef.current?.(null);
      return;
    }
    const cw = Math.max(container.clientWidth, 1);
    const ch = Math.max(container.clientHeight, 1);
    onPetBoundsChangeRef.current?.(computePetVisualBounds(modelRef.current, cw, ch));
  }, []);

  const fitCanvasAndModel = useCallback(() => {
    const container = containerRef.current;
    const app = appRef.current;
    if (!container || !app) return;

    const cw = Math.max(container.clientWidth, 1);
    const ch = Math.max(container.clientHeight, 1);
    app.renderer.resize(cw, ch);

    if (modelRef.current && layoutRef.current) {
      applyModelLayout(modelRef.current, layoutRef.current, cw, ch);
      reportPetBounds();
    }
  }, [reportPetBounds]);

  // ==================== Effect 1: PIXI 常驻 ====================
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    let destroyed = false;

    const app = new PIXI.Application({
      width: Math.max(container.clientWidth, 400),
      height: Math.max(container.clientHeight, 480),
      backgroundColor: 0x00000000,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      transparent: true,
      preserveDrawingBuffer: false,
    });
    appRef.current = app;
    installRenderGuard(app);

    const stage = app.stage || new PIXI.Container();
    stageRef.current = stage;

    Live2DModel.registerTicker(PIXI.Ticker);

    const canvas = app.view as unknown as HTMLCanvasElement;
    canvas.className = 'pet-canvas';
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'auto';

    container.innerHTML = '';
    container.appendChild(canvas);

    const ro = new ResizeObserver(() => fitCanvasAndModel());
    ro.observe(container);
    fitCanvasAndModel();

    const handleBlur = () => { app.ticker.maxFPS = 30; };
    const handleFocus = () => { app.ticker.maxFPS = 30; };
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    let isDragging = false;
    let startX = 0, startY = 0;
    let hasMoved = false;
    const CLICK_THRESHOLD = 5;
    let clickTimer: ReturnType<typeof setTimeout> | null = null;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true; hasMoved = false;
      startX = e.clientX; startY = e.clientY;
    };

    const onMouseMoveDrag = (e: MouseEvent) => {
      if (!isDragging) return;
      if (Math.abs(e.clientX - startX) > CLICK_THRESHOLD ||
          Math.abs(e.clientY - startY) > CLICK_THRESHOLD) {
        hasMoved = true;
      }
    };

    const onMouseMoveTrack = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mousePosRef.current = {
        x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
        y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
      };
      lastMouseMoveRef.current = Date.now();
    };

    const fireTapInteract = () => {
      const now = Date.now();
      if (now - lastTapAtRef.current < PET_INTERACT_COOLDOWN_MS) return;
      lastTapAtRef.current = now;

      const manifest = manifestRef.current;
      const reaction = pickInteractReaction(manifest);
      skinSetterRef.current?.applyReaction(reaction);
      const bubbleText = resolveInteractBubble(manifest, reaction);
      onInteractRef.current?.({ reaction, bubbleText });
    };

    const onMouseUp = () => {
      if (isDragging && !hasMoved) {
        if (onDoubleClickRef.current) {
          if (clickTimer) {
            clearTimeout(clickTimer); clickTimer = null;
            onDoubleClickRef.current();
          } else {
            clickTimer = setTimeout(() => {
              clickTimer = null;
              fireTapInteract();
            }, 260);
          }
        } else {
          fireTapInteract();
        }
      }
      isDragging = false; hasMoved = false;
    };

    const onMouseLeave = () => { isDragging = false; hasMoved = false; };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMoveDrag);
    canvas.addEventListener('mousemove', onMouseMoveTrack);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);

    const updateEyeTracking = () => {
      if (destroyed) return;

      if (modelRef.current) {
        const dt = Date.now() - lastMouseMoveRef.current;
        if (dt > 3000) {
          mousePosRef.current.x += (0.5 - mousePosRef.current.x) * 0.02;
          mousePosRef.current.y += (0.5 - mousePosRef.current.y) * 0.02;
        }
        const mx = mousePosRef.current.x;
        const my = mousePosRef.current.y;
        try {
          const cm = (modelRef.current as any).internalModel?.coreModel || (modelRef.current as any).coreModel;
          cm.setParameterValueById('ParamAngleX', (mx - 0.5) * 30);
          cm.setParameterValueById('ParamAngleY', (my - 0.5) * 30);
          cm.setParameterValueById('ParamEyeBallX', (mx - 0.5) * 2);
          cm.setParameterValueById('ParamEyeBallY', (my - 0.5) * 2);
        } catch { /* ignore */ }
      }
      eyeTrackingRAF.current = requestAnimationFrame(updateEyeTracking);
    };
    updateEyeTracking();

    return () => {
      destroyed = true;
      cancelAnimationFrame(eyeTrackingRAF.current);
      ro.disconnect();

      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMoveDrag);
      canvas.removeEventListener('mousemove', onMouseMoveTrack);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseLeave);

      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);

      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
      stageRef.current = null;
    };
  }, [fitCanvasAndModel]);

  // ==================== Effect 2: 皮肤热切换 ====================
  useEffect(() => {
    let aborted = false;

    const stateHandler = (state: string) => {
      setCurrentState(state);
      skinSetterRef.current?.applySettings(state);
    };

    const emotionHandler = (emotion: string) => {
      setCurrentEmotion(emotion as PetEmotion);
    };

    const reactionHandler = (reaction: string) => {
      skinSetterRef.current?.applyReaction(reaction);
    };

    let ipcCleanup: (() => void) | null = null;

    const loadSkin = async () => {
      if (modelRef.current && stageRef.current) {
        stageRef.current.removeChild(modelRef.current);
        modelRef.current.destroy?.();
        modelRef.current = null;
      }
      skinSetterRef.current?.cleanup();
      skinSetterRef.current = null;
      manifestRef.current = null;
      layoutRef.current = null;
      ipcCleanup?.();
      ipcCleanup = null;

      if (aborted) return;

      console.log(`[Live2D] Loading skin: ${skinFolder}`);
      const manifestRes = await fetch(`/skins/${skinFolder}/manifest.json`);
      const manifest = await manifestRes.json();
      manifestRef.current = manifest;
      const layout = mergeSkinLayout(manifest, skinFolder);
      layoutRef.current = layout;
      if (aborted) return;

      const winSize = getScaledWindowSizeForSkin(layout, skinFolder);
      onSizeChangeRef.current?.(winSize);

      const setter = SkinSetterFactory.createSkinSetter(manifest.renderer || 'live2d') as Live2DSkinSetter;
      await setter.init(skinFolder);
      if (aborted) { setter.cleanup(); return; }
      skinSetterRef.current = setter;

      const modelPath = `/skins/${skinFolder}/${manifest.model.entry}`;
      const model = await Live2DModel.from(modelPath);
      if (aborted) { setter.cleanup(); return; }
      modelRef.current = model;

      stageRef.current?.addChild(model);
      fitCanvasAndModel();
      requestAnimationFrame(() => {
        fitCanvasAndModel();
        reportPetBounds();
      });

      setter.setModel(model);
      stateHandler('idle');

      const u1 = window.petAPI.onEmotionChange(emotionHandler);
      const u2 = window.petAPI.onStateChange(stateHandler);
      const u3 = window.petAPI.onPlayReaction(reactionHandler);
      ipcCleanup = () => { u1(); u2(); u3(); };

      console.log(`[Live2D] Skin loaded: ${skinFolder}`);
    };

    loadSkin();

    return () => {
      aborted = true;
      ipcCleanup?.();
      if (modelRef.current && stageRef.current) {
        stageRef.current.removeChild(modelRef.current);
        modelRef.current.destroy?.();
        modelRef.current = null;
      }
      skinSetterRef.current?.cleanup();
      skinSetterRef.current = null;
      manifestRef.current = null;
      layoutRef.current = null;
      onPetBoundsChangeRef.current?.(null);
    };
  }, [skinFolder, fitCanvasAndModel]);

  // 设置面板修改布局后热更新
  useEffect(() => {
    if (!manifestRef.current || layoutVersion === 0) return;

    const manifest = manifestRef.current;
    const layout = mergeSkinLayout(manifest, skinFolder);
    layoutRef.current = layout;

    const winSize = getScaledWindowSizeForSkin(layout, skinFolder);
    onSizeChangeRef.current?.(winSize);
    fitCanvasAndModel();
  }, [layoutVersion, skinFolder, fitCanvasAndModel, reportPetBounds]);

  return (
    <div ref={containerRef} style={{
      width: '100%', height: '100%',
      position: 'relative',
      overflow: 'hidden',
    }} />
  );
}

export default Live2DPet;
