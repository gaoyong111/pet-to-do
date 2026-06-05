import { useCallback, useEffect, useState } from 'react';
import {
  buildLayoutEditorValues,
  clearSkinLayoutOverride,
  saveSkinLayoutOverride,
  type SkinLayoutOverride,
} from '../utils/skinLayoutOverride';
import type { SkinManifestLike } from '../utils/skinLayout';
import './ViewCustomizePanel.css';

interface ViewCustomizePanelProps {
  open: boolean;
  skinId: string;
  skinName: string;
  onClose: () => void;
}

type EditorValues = Required<SkinLayoutOverride>;

const DEFAULT_MANIFEST: SkinManifestLike = {
  size: { width: 400, height: 520 },
  layout: { fill: 0.9 },
  model: { scale: 1, offsetX: 0, offsetY: 0 },
};

function notifyMainWindow(skinId: string): void {
  window.petAPI?.relayToMain('skin-layout-change', skinId);
}

function ViewCustomizePanel({ open, skinId, skinName, onClose }: ViewCustomizePanelProps): JSX.Element | null {
  const [values, setValues] = useState<EditorValues>(() =>
    buildLayoutEditorValues(DEFAULT_MANIFEST, skinId),
  );
  const [manifestDefaults, setManifestDefaults] = useState<EditorValues>(() =>
    buildLayoutEditorValues(DEFAULT_MANIFEST, skinId),
  );
  const [loading, setLoading] = useState(false);

  const reloadFromStorage = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`/skins/${skinId}/manifest.json`);
      const manifest = resp.ok ? await resp.json() : DEFAULT_MANIFEST;
      const defaults = buildLayoutEditorValues(manifest, '');
      setManifestDefaults(defaults);
      setValues(buildLayoutEditorValues(manifest, skinId));
    } catch {
      const defaults = buildLayoutEditorValues(DEFAULT_MANIFEST, '');
      setManifestDefaults(defaults);
      setValues(buildLayoutEditorValues(DEFAULT_MANIFEST, skinId));
    } finally {
      setLoading(false);
    }
  }, [skinId]);

  useEffect(() => {
    if (open) reloadFromStorage();
  }, [open, reloadFromStorage]);

  const applyPatch = useCallback((patch: Partial<SkinLayoutOverride>) => {
    setValues(prev => {
      const next = { ...prev, ...patch };
      saveSkinLayoutOverride(skinId, patch);
      notifyMainWindow(skinId);
      return next;
    });
  }, [skinId]);

  const handleReset = useCallback(async () => {
    clearSkinLayoutOverride(skinId);
    notifyMainWindow(skinId);
    await reloadFromStorage();
  }, [skinId, reloadFromStorage]);

  if (!open) return null;

  return (
    <div className="view-customize-overlay" onClick={onClose}>
      <div
        className="view-customize-panel"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="view-customize-title"
      >
        <div className="view-customize-header">
          <div>
            <h3 id="view-customize-title">视图自定义</h3>
            <p className="view-customize-subtitle">当前皮肤：{skinName}</p>
          </div>
          <button type="button" className="view-customize-close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        {loading ? (
          <div className="view-customize-loading">加载中…</div>
        ) : (
          <div className="view-customize-body">
            <SliderField
              label="模型大小"
              hint={`默认 ${manifestDefaults.modelScale}`}
              min={0.5}
              max={1.5}
              step={0.01}
              value={values.modelScale}
              format={v => `${Math.round(v * 100)}%`}
              onChange={v => applyPatch({ modelScale: v })}
            />
            <SliderField
              label="填充比例"
              hint={`默认 ${manifestDefaults.fill}`}
              min={0.5}
              max={1}
              step={0.01}
              value={values.fill}
              format={v => `${Math.round(v * 100)}%`}
              onChange={v => applyPatch({ fill: v })}
            />
            <SliderField
              label="水平偏移"
              hint="正数向右"
              min={-120}
              max={120}
              step={1}
              value={values.offsetX}
              format={v => `${v}px`}
              onChange={v => applyPatch({ offsetX: v })}
            />
            <SliderField
              label="垂直偏移"
              hint="正数向下（过大可能裁脚）"
              min={-120}
              max={120}
              step={1}
              value={values.offsetY}
              format={v => `${v}px`}
              onChange={v => applyPatch({ offsetY: v })}
            />

            <div className="view-customize-divider">窗口</div>

            <SliderField
              label="窗口缩放"
              hint={`默认 ${manifestDefaults.windowScale}`}
              min={0.75}
              max={2}
              step={0.05}
              value={values.windowScale}
              format={v => `${Math.round(v * 100)}%`}
              onChange={v => applyPatch({ windowScale: v })}
            />
            <NumberField
              label="基准宽度"
              hint={`默认 ${manifestDefaults.windowWidth}px`}
              min={300}
              max={800}
              value={values.windowWidth}
              onChange={v => applyPatch({ windowWidth: v })}
            />
            <NumberField
              label="基准高度"
              hint={`默认 ${manifestDefaults.windowHeight}px`}
              min={400}
              max={1000}
              value={values.windowHeight}
              onChange={v => applyPatch({ windowHeight: v })}
            />
          </div>
        )}

        <div className="view-customize-footer">
          <button type="button" className="view-customize-reset" onClick={handleReset}>
            恢复默认
          </button>
          <button type="button" className="view-customize-done" onClick={onClose}>
            完成
          </button>
        </div>
      </div>
    </div>
  );
}

function SliderField({
  label,
  hint,
  min,
  max,
  step,
  value,
  format,
  onChange,
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
      <input
        type="range"
        className="view-customize-range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

function NumberField({
  label,
  hint,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}): JSX.Element {
  return (
    <div className="view-customize-field">
      <div className="view-customize-field-head">
        <span className="view-customize-label">{label}</span>
      </div>
      {hint && <div className="view-customize-hint">{hint}</div>}
      <input
        type="number"
        className="view-customize-number"
        min={min}
        max={max}
        value={value}
        onChange={e => {
          const n = parseInt(e.target.value, 10);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
    </div>
  );
}

export default ViewCustomizePanel;
