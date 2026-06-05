import { useCallback, useEffect, useState } from 'react';
import {
  BUBBLE_COLOR_TYPE_LABELS,
  BUBBLE_THEME_OPTIONS,
  DEFAULT_BUBBLE_STYLE,
  loadBubbleStyle,
  resetBubbleStyle,
  saveBubbleStyle,
  type BubbleColorType,
  type BubbleStyleConfig,
  type BubbleTextAlign,
  type BubbleTheme,
} from '../utils/bubbleStyle';
import {
  getSkinBubblePositionAdjust,
  saveSkinLayoutOverride,
} from '../utils/skinLayoutOverride';
import './ViewCustomizePanel.css';
import './BubbleCustomizePanel.css';

interface BubbleCustomizePanelProps {
  open: boolean;
  skinId: string;
  skinName: string;
  onClose: () => void;
}

function notifyMainWindow(): void {
  window.petAPI?.relayToMain('bubble-style-change');
}

function BubbleCustomizePanel({ open, skinId, skinName, onClose }: BubbleCustomizePanelProps): JSX.Element | null {
  const [style, setStyle] = useState<BubbleStyleConfig>(() => loadBubbleStyle());
  const [skinPos, setSkinPos] = useState(() => getSkinBubblePositionAdjust(skinId));

  useEffect(() => {
    if (open) {
      setStyle(loadBubbleStyle());
      setSkinPos(getSkinBubblePositionAdjust(skinId));
    }
  }, [open, skinId]);

  const applyStyle = useCallback((patch: Partial<BubbleStyleConfig>) => {
    setStyle(prev => {
      const next = saveBubbleStyle(patch);
      notifyMainWindow();
      return next;
    });
  }, []);

  const applyColor = useCallback((type: BubbleColorType, field: 'bg' | 'border' | 'text', value: string) => {
    setStyle(prev => {
      const next = saveBubbleStyle({
        theme: 'custom',
        colors: {
          ...prev.colors,
          [type]: { ...prev.colors[type], [field]: value },
        },
      });
      notifyMainWindow();
      return next;
    });
  }, []);

  const applySkinPos = useCallback((patch: Partial<typeof skinPos>) => {
    setSkinPos(prev => {
      const next = { ...prev, ...patch };
      saveSkinLayoutOverride(skinId, {
        bubbleOffsetX: next.offsetX,
        bubbleOffsetY: next.offsetY,
        bubbleGapAboveHead: next.gapAboveHead,
      });
      window.petAPI?.relayToMain('skin-layout-change', skinId);
      return next;
    });
  }, [skinId]);

  const handleReset = useCallback(() => {
    const next = resetBubbleStyle();
    setStyle(next);
    saveSkinLayoutOverride(skinId, {
      bubbleOffsetX: 0,
      bubbleOffsetY: 0,
      bubbleGapAboveHead: 10,
    });
    setSkinPos({ offsetX: 0, offsetY: 0, gapAboveHead: 10 });
    notifyMainWindow();
    window.petAPI?.relayToMain('skin-layout-change', skinId);
  }, [skinId]);

  if (!open) return null;

  return (
    <div className="view-customize-overlay" onClick={onClose}>
      <div
        className="view-customize-panel bubble-customize-panel"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="bubble-customize-title"
      >
        <div className="view-customize-header">
          <div>
            <h3 id="bubble-customize-title">聊天气泡样式</h3>
            <p className="view-customize-subtitle">全局样式 · 位置微调针对「{skinName}」</p>
          </div>
          <button type="button" className="view-customize-close" onClick={onClose} aria-label="关闭">✕</button>
        </div>

        <div className="view-customize-body bubble-customize-body">
          <div className="bubble-preview-wrap">
            <div
              className="bubble-preview bubble-emotion"
              style={{
                fontSize: style.fontSize,
                fontWeight: style.fontWeight,
                lineHeight: style.lineHeight,
                textAlign: style.textAlign,
                maxWidth: style.maxWidth,
                padding: `${style.paddingY}px ${style.paddingX}px`,
                borderRadius: style.borderRadius,
                borderWidth: style.borderWidth,
                borderStyle: 'solid',
                background: style.colors.emotion.bg,
                borderColor: style.colors.emotion.border,
                color: style.colors.emotion.text,
                boxShadow: style.shadowBlur > 0
                  ? `0 ${style.shadowY}px ${style.shadowBlur}px rgba(0,0,0,${style.shadowOpacity})`
                  : 'none',
                backdropFilter: style.backdropBlur > 0 ? `blur(${style.backdropBlur}px)` : undefined,
                opacity: style.opacity,
              }}
            >
              预览：你好呀~
              {style.showTail && <span className="bubble-preview-tail" style={{ borderTopColor: style.colors.emotion.bg }} />}
            </div>
          </div>

          <div className="view-customize-field">
            <div className="view-customize-field-head">
              <span className="view-customize-label">主题预设</span>
            </div>
            <select
              className="settings-select bubble-theme-select"
              value={style.theme}
              onChange={e => applyStyle({ theme: e.target.value as BubbleTheme })}
            >
              {BUBBLE_THEME_OPTIONS.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          <SliderField label="字号" min={11} max={18} step={1} value={style.fontSize} format={v => `${v}px`} onChange={v => applyStyle({ fontSize: v })} />
          <SliderField label="字重" min={400} max={700} step={100} value={style.fontWeight} format={v => String(v)} onChange={v => applyStyle({ fontWeight: v })} />
          <SliderField label="行高" min={1.2} max={1.9} step={0.05} value={style.lineHeight} format={v => v.toFixed(2)} onChange={v => applyStyle({ lineHeight: v })} />

          <div className="view-customize-field">
            <div className="view-customize-field-head">
              <span className="view-customize-label">文字对齐</span>
            </div>
            <div className="bubble-align-row">
              {(['left', 'center', 'right'] as BubbleTextAlign[]).map(a => (
                <button
                  key={a}
                  type="button"
                  className={`bubble-align-btn ${style.textAlign === a ? 'active' : ''}`}
                  onClick={() => applyStyle({ textAlign: a })}
                >
                  {a === 'left' ? '左' : a === 'center' ? '中' : '右'}
                </button>
              ))}
            </div>
          </div>

          <div className="view-customize-divider">尺寸与形状</div>
          <SliderField label="最大宽度" min={160} max={360} step={4} value={style.maxWidth} format={v => `${v}px`} onChange={v => applyStyle({ maxWidth: v })} />
          <SliderField label="文字区最大高度" min={60} max={220} step={4} value={style.maxTextHeight} format={v => `${v}px`} onChange={v => applyStyle({ maxTextHeight: v })} />
          <SliderField label="水平内边距" min={8} max={28} step={1} value={style.paddingX} format={v => `${v}px`} onChange={v => applyStyle({ paddingX: v })} />
          <SliderField label="垂直内边距" min={6} max={24} step={1} value={style.paddingY} format={v => `${v}px`} onChange={v => applyStyle({ paddingY: v })} />
          <SliderField label="圆角" min={6} max={28} step={1} value={style.borderRadius} format={v => `${v}px`} onChange={v => applyStyle({ borderRadius: v })} />
          <SliderField label="边框粗细" min={0} max={3} step={0.5} value={style.borderWidth} format={v => `${v}px`} onChange={v => applyStyle({ borderWidth: v })} />

          <div className="view-customize-divider">视觉效果</div>
          <SliderField label="透明度" min={0.65} max={1} step={0.01} value={style.opacity} format={v => `${Math.round(v * 100)}%`} onChange={v => applyStyle({ opacity: v })} />
          <SliderField label="阴影模糊" min={0} max={40} step={1} value={style.shadowBlur} format={v => `${v}px`} onChange={v => applyStyle({ shadowBlur: v })} />
          <SliderField label="阴影偏移" min={0} max={20} step={1} value={style.shadowY} format={v => `${v}px`} onChange={v => applyStyle({ shadowY: v })} />
          <SliderField label="阴影浓度" min={0} max={0.45} step={0.01} value={style.shadowOpacity} format={v => `${Math.round(v * 100)}%`} onChange={v => applyStyle({ shadowOpacity: v })} />
          <SliderField label="毛玻璃模糊" min={0} max={24} step={1} value={style.backdropBlur} format={v => v === 0 ? '关' : `${v}px`} onChange={v => applyStyle({ backdropBlur: v })} />

          <div className="view-customize-field">
            <div className="view-customize-field-head">
              <span className="view-customize-label">浮动动画</span>
              <label className="bubble-toggle-inline">
                <input
                  type="checkbox"
                  checked={style.enableFloat}
                  onChange={e => applyStyle({ enableFloat: e.target.checked })}
                />
                启用
              </label>
            </div>
            {style.enableFloat && (
              <SliderField label="浮动幅度" min={0} max={10} step={1} value={style.floatAmplitude} format={v => `${v}px`} onChange={v => applyStyle({ floatAmplitude: v })} />
            )}
          </div>

          <div className="view-customize-field">
            <div className="view-customize-field-head">
              <span className="view-customize-label">气泡小尾巴</span>
              <label className="bubble-toggle-inline">
                <input
                  type="checkbox"
                  checked={style.showTail}
                  onChange={e => applyStyle({ showTail: e.target.checked })}
                />
                显示
              </label>
            </div>
            {style.showTail && (
              <SliderField label="尾巴大小" min={4} max={14} step={1} value={style.tailSize} format={v => `${v}px`} onChange={v => applyStyle({ tailSize: v })} />
            )}
          </div>

          {style.theme === 'custom' && (
            <>
              <div className="view-customize-divider">自定义配色</div>
              {(Object.keys(BUBBLE_COLOR_TYPE_LABELS) as BubbleColorType[]).map(type => (
                <div key={type} className="bubble-color-group">
                  <div className="view-customize-label">{BUBBLE_COLOR_TYPE_LABELS[type]}</div>
                  <div className="bubble-color-row">
                    <ColorField label="背景" value={style.colors[type].bg} onChange={v => applyColor(type, 'bg', v)} />
                    <ColorField label="边框" value={style.colors[type].border} onChange={v => applyColor(type, 'border', v)} />
                    <ColorField label="文字" value={style.colors[type].text} onChange={v => applyColor(type, 'text', v)} />
                  </div>
                </div>
              ))}
            </>
          )}

          <div className="view-customize-divider">位置（跟随角色头顶）</div>
          <SliderField label="全局水平偏移" hint="相对角色中心" min={-120} max={120} step={1} value={style.offsetX} format={v => `${v}px`} onChange={v => applyStyle({ offsetX: v })} />
          <SliderField label="全局垂直偏移" hint="负=更高" min={-120} max={120} step={1} value={style.offsetY} format={v => `${v}px`} onChange={v => applyStyle({ offsetY: v })} />
          <SliderField label="全局头顶间距" min={-20} max={80} step={1} value={style.gapAboveHead} format={v => `${v}px`} onChange={v => applyStyle({ gapAboveHead: v })} />

          <SliderField label={`「${skinName}」水平微调`} min={-80} max={80} step={1} value={skinPos.offsetX} format={v => `${v}px`} onChange={v => applySkinPos({ offsetX: v })} />
          <SliderField label={`「${skinName}」垂直微调`} min={-80} max={80} step={1} value={skinPos.offsetY} format={v => `${v}px`} onChange={v => applySkinPos({ offsetY: v })} />
          <SliderField label={`「${skinName}」头顶间距`} min={-20} max={80} step={1} value={skinPos.gapAboveHead} format={v => `${v}px`} onChange={v => applySkinPos({ gapAboveHead: v })} />
        </div>

        <div className="view-customize-footer">
          <button type="button" className="view-customize-reset" onClick={handleReset}>恢复默认</button>
          <button type="button" className="view-customize-done" onClick={onClose}>完成</button>
        </div>
      </div>
    </div>
  );
}

function SliderField({
  label, hint, min, max, step, value, format, onChange,
}: {
  label: string;
  hint?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}): JSX.Element {
  return (
    <div className="view-customize-field">
      <div className="view-customize-field-head">
        <span className="view-customize-label">{label}</span>
        <span className="view-customize-value">{format(value)}</span>
      </div>
      {hint && <div className="view-customize-hint">{hint}</div>}
      <input type="range" className="view-customize-range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} />
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }): JSX.Element {
  const safe = value.startsWith('#') ? value : '#ffffff';
  return (
    <label className="bubble-color-field">
      <span>{label}</span>
      <input type="color" value={safe.length === 7 ? safe : '#ffffff'} onChange={e => onChange(e.target.value)} />
    </label>
  );
}

export default BubbleCustomizePanel;
