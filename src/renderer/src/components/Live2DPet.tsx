import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display/cubism4';
import { PetEmotion } from '../types';
import { SkinSetterFactory } from './skin-setters/SkinSetterFactory';
import { Live2DSkinSetter } from './skin-setters/Live2DSkinSetter';

if (typeof window !== 'undefined') {
  (window as any).PIXI = PIXI;
}

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 480;

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

interface Live2DPetProps {
  skinFolder: string;
  onSizeChange?: (width: number, height: number) => void;
  onClick?: () => void;
  onDoubleClick?: () => void;
}

function Live2DPet({ skinFolder, onSizeChange, onClick, onDoubleClick }: Live2DPetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const stageRef = useRef<PIXI.Container | null>(null);
  const modelRef = useRef<Live2DModel | null>(null);
  const skinSetterRef = useRef<Live2DSkinSetter | null>(null);
  const [, setCurrentState] = useState<string>('idle');
  const [, setCurrentEmotion] = useState<PetEmotion>('normal');

  // 视线追踪
  const mousePosRef = useRef({ x: 0.5, y: 0.5 });
  const lastMouseMoveRef = useRef(Date.now());
  const eyeTrackingRAF = useRef<number>(0);

  // ==================== Effect 1: PIXI 常驻（仅挂载一次） ====================
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    let destroyed = false;

    // --- PIXI Application ---
    const app = new PIXI.Application({
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: 0x00000000,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      transparent: true,
      preserveDrawingBuffer: false,
    });
    appRef.current = app;
    installRenderGuard(app);

    // --- Stage ---
    const stage = app.stage || new PIXI.Container();
    stageRef.current = stage;

    Live2DModel.registerTicker(PIXI.Ticker);

    // --- Canvas ---
    const canvas = app.view as unknown as HTMLCanvasElement;
    canvas.className = 'pet-canvas';
    canvas.style.position = 'absolute';
    canvas.style.pointerEvents = 'auto';

    const updateCanvasSize = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const scale = Math.min(cw / CANVAS_WIDTH, ch / CANVAS_HEIGHT);
      canvas.style.width = `${CANVAS_WIDTH * scale}px`;
      canvas.style.height = `${CANVAS_HEIGHT * scale}px`;
      canvas.style.top = '50%';
      canvas.style.left = '50%';
      canvas.style.transform = 'translate(-50%, -50%)';
    };
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    container.innerHTML = '';
    container.appendChild(canvas);

    // --- 失焦降帧 ---
    const handleBlur = () => { app.ticker.maxFPS = 30; };
    const handleFocus = () => { app.ticker.maxFPS = 30; };
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    // --- 鼠标事件（拖拽检测 + 视线追踪） ---
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

    const onMouseUp = () => {
      if (isDragging && !hasMoved) {
        if (onDoubleClick) {
          if (clickTimer) {
            clearTimeout(clickTimer); clickTimer = null;
            onDoubleClick();
          } else {
            clickTimer = setTimeout(() => {
              clickTimer = null;
              if (onClick) onClick();
            }, 260);
          }
        } else if (onClick) {
          onClick();
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

    // --- 视线追踪循环 ---
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

    // --- 清理 ---
    return () => {
      destroyed = true;
      cancelAnimationFrame(eyeTrackingRAF.current);

      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMoveDrag);
      canvas.removeEventListener('mousemove', onMouseMoveTrack);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseLeave);

      window.removeEventListener('resize', updateCanvasSize);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);

      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
      stageRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    // 持有 IPC 清理函数（在 effect 闭包内管理）
    let ipcCleanup: (() => void) | null = null;

    const loadSkin = async () => {
      // 1) 清理上一个模型（只移除模型，不动 PIXI app 和 stage）
      if (modelRef.current && stageRef.current) {
        stageRef.current.removeChild(modelRef.current);
        modelRef.current.destroy?.();
        modelRef.current = null;
      }
      skinSetterRef.current?.cleanup();
      skinSetterRef.current = null;
      ipcCleanup?.();
      ipcCleanup = null;

      if (aborted) return;

      // 2) 加载 manifest
      console.log(`[Live2D] Loading skin: ${skinFolder}`);
      const manifestRes = await fetch(`/skins/${skinFolder}/manifest.json`);
      const manifest = await manifestRes.json();
      if (aborted) return;

      // 3) 窗口大小
      if (manifest.size && onSizeChange) {
        onSizeChange(manifest.size.width, manifest.size.height);
      }

      // 4) SkinSetter
      const setter = SkinSetterFactory.createSkinSetter(manifest.renderer || 'live2d') as Live2DSkinSetter;
      await setter.init(skinFolder);
      if (aborted) { setter.cleanup(); return; }
      skinSetterRef.current = setter;

      // 5) 加载模型
      const modelPath = `/skins/${skinFolder}/${manifest.model.entry}`;
      const model = await Live2DModel.from(modelPath);
      if (aborted) { setter.cleanup(); return; }
      modelRef.current = model;

      // 6) 缩放 & 定位
      const baseSize = 1000;
      const s = Math.min(CANVAS_WIDTH / baseSize, CANVAS_HEIGHT / baseSize)
                * (manifest.model.scale || 0.2) * 1.2;
      model.scale.set(s);
      model.x = CANVAS_WIDTH / 2;
      model.y = CANVAS_HEIGHT;
      model.anchor.set(0.5, 1.0);

      // 7) 加入舞台
      stageRef.current?.addChild(model);

      // 8) 绑定模型到 SkinSetter（含 physics 初始化）
      setter.setModel(model);

      // 9) 初始化状态
      stateHandler('idle');

      // 10) IPC 监听
      const u1 = window.petAPI.onEmotionChange(emotionHandler);
      const u2 = window.petAPI.onStateChange(stateHandler);
      const u3 = window.petAPI.onPlayReaction(reactionHandler);
      ipcCleanup = () => { u1(); u2(); u3(); };

      console.log(`[Live2D] Skin loaded: ${skinFolder}`);
    };

    loadSkin();

    return () => {
      aborted = true;
      // 先清 IPC
      ipcCleanup?.();
      // 再清模型
      if (modelRef.current && stageRef.current) {
        stageRef.current.removeChild(modelRef.current);
        modelRef.current.destroy?.();
        modelRef.current = null;
      }
      skinSetterRef.current?.cleanup();
      skinSetterRef.current = null;
    };
  }, [skinFolder, onSizeChange]);

  return (
    <div ref={containerRef} style={{
      width: '100%', height: '100%',
      position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }} />
  );
}

export default Live2DPet;
