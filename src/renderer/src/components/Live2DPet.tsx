import { useEffect, useRef, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { Live2DModel } from 'pixi-live2d-display/cubism4';
import { PetEmotion } from '../types';
import { SkinSetterFactory } from './skin-setters/SkinSetterFactory';
import { Live2DSkinSetter } from './skin-setters/Live2DSkinSetter';

if (typeof window !== 'undefined') {
  (window as any).PIXI = PIXI;
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
  const modelRef = useRef<Live2DModel | null>(null);
  const skinSetterRef = useRef<any>(null);
  const [currentState, setCurrentState] = useState<string>('idle');
  const [currentEmotion, setCurrentEmotion] = useState<PetEmotion>('normal');
  
  // 鼠标位置追踪（用于平滑视线回归）
  const mousePosRef = useRef({ x: 0.5, y: 0.5 });
  const lastMouseMoveRef = useRef(Date.now());
  const eyeTrackingRAF = useRef<number>(0);

  function installRenderGuard(app: PIXI.Application) {
    const guardedRender = () => {
      try {
        app.render();
      } catch (error) {
        console.error('[Live2D] Pixi render error.', error);
        app.ticker.stop();
      }
    };

    app.ticker.remove(app.render, app);
    app.ticker.add(guardedRender);
  }

  const handleEmotionChange = useCallback((emotion: PetEmotion) => {
    setCurrentEmotion(emotion);
  }, []);

  const handleStateChange = useCallback((state: string) => {
    setCurrentState(state);
    if (skinSetterRef.current) {
      skinSetterRef.current.applySettings(state);
    }
  }, []);

  // 平滑视线追踪 + 空闲时回归中心
  const updateEyeTracking = useCallback(() => {
    if (!modelRef.current) {
      eyeTrackingRAF.current = requestAnimationFrame(updateEyeTracking);
      return;
    }

    const timeSinceMove = Date.now() - lastMouseMoveRef.current;
    // 如果 3 秒没动鼠标，视线慢慢回到中心
    if (timeSinceMove > 3000) {
      mousePosRef.current.x += (0.5 - mousePosRef.current.x) * 0.02;
      mousePosRef.current.y += (0.5 - mousePosRef.current.y) * 0.02;
    }

    const mx = mousePosRef.current.x;
    const my = mousePosRef.current.y;
    const angleX = (mx - 0.5) * 30;
    const angleY = (my - 0.5) * 30;
    const eyeX = (mx - 0.5) * 2;
    const eyeY = (my - 0.5) * 2;

    try {
      const cm = modelRef.current.coreModel;
      cm.setParameterValueById('ParamAngleX', angleX);
      cm.setParameterValueById('ParamAngleY', angleY);
      cm.setParameterValueById('ParamEyeBallX', eyeX);
      cm.setParameterValueById('ParamEyeBallY', eyeY);
    } catch { /* 部分模型可能没有这些参数 */ }

    eyeTrackingRAF.current = requestAnimationFrame(updateEyeTracking);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    let canvas: HTMLCanvasElement | null = null;
    let handleMouseDown: ((e: MouseEvent) => void) | null = null;
    let handleMouseMove: ((e: MouseEvent) => void) | null = null;
    let handleMouseMoveForTracking: ((e: MouseEvent) => void) | null = null;
    let handleMouseUp: (() => void) | null = null;
    let handleMouseLeave: (() => void) | null = null;
    let unsubscribeEmotion: (() => void) | null = null;
    let unsubscribeState: (() => void) | null = null;
    let updateCanvasSize: (() => void) | null = null;

    const init = async () => {
      try {
        console.log('开始初始化...');
        
        if (appRef.current) {
          appRef.current.destroy(true);
        }
        
        if (skinSetterRef.current) {
          skinSetterRef.current.cleanup();
          skinSetterRef.current = null;
        }
        
        // 固定canvas大小，使用默认值或从manifest中获取
        const defaultCanvasWidth = 400;
        const defaultCanvasHeight = 480;
        
        console.log('Canvas尺寸:', defaultCanvasWidth, 'x', defaultCanvasHeight);
        
        const app = new PIXI.Application({
          width: defaultCanvasWidth,
          height: defaultCanvasHeight,
          backgroundColor: 0x00000000,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          transparent: true,
          preserveDrawingBuffer: false,
        });
        appRef.current = app;
        
        containerRef.current.innerHTML = '';
        canvas = app.view as unknown as HTMLCanvasElement;
        canvas.className = 'pet-canvas';
        canvas.style.position = 'absolute';
        canvas.style.pointerEvents = 'auto';
        
        // 计算canvas的缩放比例，保持宽高比
        updateCanvasSize = () => {
            if (!containerRef.current || !canvas) return;
            
            const containerWidth = containerRef.current.clientWidth;
            const containerHeight = containerRef.current.clientHeight;
            const canvasWidth = defaultCanvasWidth;
            const canvasHeight = defaultCanvasHeight;
            
            // 计算缩放比例，保持宽高比
            const scaleX = containerWidth / canvasWidth;
            const scaleY = containerHeight / canvasHeight;
            const scale = Math.min(scaleX, scaleY);
            
            // 计算canvas的实际显示尺寸
            const displayWidth = canvasWidth * scale;
            const displayHeight = canvasHeight * scale;
            
            // 设置canvas样式
            canvas.style.width = `${displayWidth}px`;
            canvas.style.height = `${displayHeight}px`;
            canvas.style.top = '50%';
            canvas.style.left = '50%';
            canvas.style.transform = `translate(-50%, -50%)`;
        };
        
        // 初始更新
        updateCanvasSize();
        
        // 监听窗口大小变化
        window.addEventListener('resize', updateCanvasSize);
        
        containerRef.current.appendChild(canvas);
        
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let hasMoved = false;
        let clickThreshold = 5;
        
        handleMouseDown = (e) => {
            isDragging = true;
            hasMoved = false;
            startX = e.clientX;
            startY = e.clientY;
        };
        
        handleMouseMove = (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            if (!hasMoved && (Math.abs(deltaX) > clickThreshold || Math.abs(deltaY) > clickThreshold)) {
                hasMoved = true;
            }
        };
        
        // 鼠标移动事件（用于视线追踪）
        handleMouseMoveForTracking = (e) => {
            if (canvas) {
                const rect = canvas.getBoundingClientRect();
                // 计算鼠标在canvas上的相对位置，保持0-1范围
                mousePosRef.current = {
                    x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
                    y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
                };
                lastMouseMoveRef.current = Date.now();
            }
        };
        
        let clickTimer: ReturnType<typeof setTimeout> | null = null;

        handleMouseUp = () => {
            if (isDragging && !hasMoved) {
                if (onDoubleClick) {
                    if (clickTimer) {
                        // 第二次点击：触发双击
                        clearTimeout(clickTimer);
                        clickTimer = null;
                        onDoubleClick();
                    } else {
                        // 第一次点击：延迟等待，看是否有第二次
                        clickTimer = setTimeout(() => {
                            clickTimer = null;
                            if (onClick) onClick();
                        }, 260);
                    }
                } else if (onClick) {
                    onClick();
                }
            }
            isDragging = false;
            hasMoved = false;
        };
        
        handleMouseLeave = () => {
            isDragging = false;
            hasMoved = false;
        };
        
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mousemove', handleMouseMoveForTracking);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mouseleave', handleMouseLeave);
        
        console.log('PIXI应用创建成功');
        
        const stage = app.stage || new PIXI.Container();
        if (!app.stage) {
          console.warn('app.stage为null，使用自定义Container');
        }
        
        Live2DModel.registerTicker(PIXI.Ticker);
        
        const manifestPath = `/skins/${skinFolder}/manifest.json`;
        console.log('加载manifest:', manifestPath);
        const manifestRes = await fetch(manifestPath);
        const manifest = await manifestRes.json();
        console.log('manifest:', manifest);
        
        // 读取皮肤尺寸并调整窗口大小
        if (manifest.size && onSizeChange) {
            const { width, height } = manifest.size;
            onSizeChange(width, height);
        }
        
        const skinType = manifest.renderer || 'live2d';
        skinSetterRef.current = SkinSetterFactory.createSkinSetter(skinType);
        await skinSetterRef.current.init(skinFolder);
        
        const modelPath = `/skins/${skinFolder}/${manifest.model.entry}`;
        console.log('加载模型:', modelPath);
        
        try {
          const model = await Live2DModel.from(modelPath);
          modelRef.current = model;
          console.log('模型加载完成:', model);
          
          const baseSize = 1000;
          const scaleX = defaultCanvasWidth / baseSize;
          const scaleY = defaultCanvasHeight / baseSize;
          // 增加缩放因子，让角色更大
          const scale = Math.min(scaleX, scaleY) * manifest.model.scale * 1.2;
          model.scale.set(scale);
          
          model.x = defaultCanvasWidth / 2;
          model.y = defaultCanvasHeight;
          
          model.anchor.set(0.5, 1.0);
          
          console.log('Canvas尺寸:', defaultCanvasWidth, 'x', defaultCanvasHeight);
          console.log('模型缩放:', scale);
          console.log('模型位置:', model.x, ',', model.y);
          
          stage.addChild(model);
          console.log('模型已添加到舞台');
          
          if (!app.stage && app.renderer) {
            console.log('使用手动渲染循环');
            const renderLoop = () => {
              try {
                app.renderer.render(stage);
              } catch (e) {
                console.error('渲染错误:', e);
              }
              requestAnimationFrame(renderLoop);
            };
            renderLoop();
          }
          
          if (skinSetterRef.current instanceof Live2DSkinSetter) {
            skinSetterRef.current.setModel(model);
          }
          
          handleStateChange('idle');
          
          unsubscribeEmotion = window.petAPI.onEmotionChange(handleEmotionChange);
          
          unsubscribeState = window.petAPI.onStateChange(handleStateChange);
          
          // 启动视线追踪
          updateEyeTracking();
          
          console.log('模型初始化完成');
          
        } catch (modelError) {
          console.error('模型加载失败:', modelError);
        }
        
      } catch (error) {
        console.error('初始化失败:', error);
      }
    };

    init();

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
      if (skinSetterRef.current) {
        skinSetterRef.current.cleanup();
        skinSetterRef.current = null;
      }
      modelRef.current = null;
      if (canvas) {
        if (handleMouseDown) canvas.removeEventListener('mousedown', handleMouseDown);
        if (handleMouseMove) canvas.removeEventListener('mousemove', handleMouseMove);
        if (handleMouseMoveForTracking) canvas.removeEventListener('mousemove', handleMouseMoveForTracking);
        if (handleMouseUp) canvas.removeEventListener('mouseup', handleMouseUp);
        if (handleMouseLeave) canvas.removeEventListener('mouseleave', handleMouseLeave);
      }
      // 移除窗口大小变化监听器
      if (updateCanvasSize) {
        window.removeEventListener('resize', updateCanvasSize);
      }
      if (eyeTrackingRAF.current) {
        cancelAnimationFrame(eyeTrackingRAF.current);
      }
      if (unsubscribeEmotion) {
        unsubscribeEmotion();
      }
      if (unsubscribeState) {
        unsubscribeState();
      }
    };
  }, [skinFolder, handleEmotionChange, handleStateChange]);

  return (
    <div 
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    />
  );
}

export default Live2DPet;
