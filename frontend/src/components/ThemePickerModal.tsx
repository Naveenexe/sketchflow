import { X, RotateCcw, AlertTriangle } from 'lucide-react';
import {
  THEME_MAP,
  THEME_PRESETS,
  getContrastRatio,
  useThemeStore,
  type CanvasStyle,
} from '../store/themeStore';

interface ThemePickerModalProps {
  onClose: () => void;
  showEditorOptions?: boolean;
}

export function ThemePickerModal({
  onClose,
  showEditorOptions = true,
}: ThemePickerModalProps) {
  const {
    presetId,
    customCanvas,
    customPen,
    sketchyStyle,
    canvasStyle,
    autoHideBar,
    setPreset,
    setCustomCanvas,
    setCustomPen,
    resetCustomColors,
    setSketchyStyle,
    setCanvasStyle,
    setAutoHideBar,
  } = useThemeStore();

  const currentPreset = THEME_MAP[presetId] || THEME_MAP.paper;
  const activeCanvas = customCanvas || currentPreset.canvas;
  const activePen = customPen || currentPreset.pen;
  const hasCustomOverrides = Boolean(customCanvas || customPen);
  const contrastRatio = getContrastRatio(activePen, activeCanvas);
  const lowContrast = contrastRatio < 3;

  const lightPresets = THEME_PRESETS.filter((p) => p.mode === 'light');
  const darkPresets = THEME_PRESETS.filter((p) => p.mode === 'dark');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card theme-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Theme and canvas settings"
      >
        <div className="modal-header">
          <div>
            <h2>Appearance &amp; Canvas</h2>
            <p>Choose a theme preset or customize whiteboard colors.</p>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="theme-section">
          <div className="theme-section-label">Light themes</div>
          <div className="theme-grid">
            {lightPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`theme-swatch-card ${presetId === preset.id ? 'active' : ''}`}
                onClick={() => setPreset(preset.id)}
              >
                <div className="theme-swatch-bars">
                  <span style={{ backgroundColor: preset.bg }} />
                  <span style={{ backgroundColor: preset.surface }} />
                  <span style={{ backgroundColor: preset.accent }} />
                </div>
                <span className="theme-swatch-name">{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="theme-section">
          <div className="theme-section-label">Dark themes</div>
          <div className="theme-grid">
            {darkPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`theme-swatch-card ${presetId === preset.id ? 'active' : ''}`}
                onClick={() => setPreset(preset.id)}
              >
                <div className="theme-swatch-bars">
                  <span style={{ backgroundColor: preset.bg }} />
                  <span style={{ backgroundColor: preset.surface }} />
                  <span style={{ backgroundColor: preset.accent }} />
                </div>
                <span className="theme-swatch-name">{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="theme-section">
          <div className="theme-section-header">
            <span className="theme-section-label">Custom canvas &amp; pen</span>
            {hasCustomOverrides && (
              <button
                type="button"
                className="text-action-btn"
                onClick={resetCustomColors}
              >
                <RotateCcw size={13} strokeWidth={1.5} />
                <span>Reset to theme</span>
              </button>
            )}
          </div>

          <div className="color-override-row">
            <label className="color-override-item">
              <span>Whiteboard</span>
              <div className="color-input-wrap">
                <input
                  type="color"
                  value={activeCanvas}
                  onChange={(e) => setCustomCanvas(e.target.value)}
                  aria-label="Whiteboard color"
                />
                <code>{activeCanvas.toUpperCase()}</code>
              </div>
            </label>

            <label className="color-override-item">
              <span>Default pen</span>
              <div className="color-input-wrap">
                <input
                  type="color"
                  value={activePen}
                  onChange={(e) => setCustomPen(e.target.value)}
                  aria-label="Default pen color"
                />
                <code>{activePen.toUpperCase()}</code>
              </div>
            </label>
          </div>

          {lowContrast && (
            <div className="contrast-warning" role="status">
              <AlertTriangle size={14} strokeWidth={1.5} />
              <span>
                Low contrast ({contrastRatio.toFixed(1)}:1) between pen and
                whiteboard colors.
              </span>
            </div>
          )}
        </div>

        {showEditorOptions && (
          <div className="theme-section">
            <div className="theme-section-label">Canvas preferences</div>

            <div className="pref-row">
              <span className="pref-label">Background style</span>
              <div className="segmented-control">
                {(['plain', 'dots', 'tinted'] as CanvasStyle[]).map((style) => (
                  <button
                    key={style}
                    type="button"
                    className={`segmented-btn ${canvasStyle === style ? 'active' : ''}`}
                    onClick={() => setCanvasStyle(style)}
                  >
                    {style === 'plain'
                      ? 'Plain'
                      : style === 'dots'
                      ? 'Dot grid'
                      : 'Tinted'}
                  </button>
                ))}
              </div>
            </div>

            <div className="pref-row">
              <span className="pref-label">Shape style</span>
              <div className="segmented-control">
                <button
                  type="button"
                  className={`segmented-btn ${!sketchyStyle ? 'active' : ''}`}
                  onClick={() => setSketchyStyle(false)}
                >
                  Clean
                </button>
                <button
                  type="button"
                  className={`segmented-btn ${sketchyStyle ? 'active' : ''}`}
                  onClick={() => setSketchyStyle(true)}
                >
                  Sketchy
                </button>
              </div>
            </div>

            <label className="pref-checkbox-row">
              <input
                type="checkbox"
                checked={autoHideBar}
                onChange={(e) => setAutoHideBar(e.target.checked)}
              />
              <span>Auto-hide top bar while drawing</span>
            </label>
          </div>
        )}

        <div className="modal-footer modal-footer-between">
          <span className="excalidraw-credit">Built with Excalidraw</span>
          <button type="button" className="sf-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
