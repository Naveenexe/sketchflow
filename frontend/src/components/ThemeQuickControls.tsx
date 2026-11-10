import { useState } from 'react';
import { Moon, Palette, Sun } from 'lucide-react';
import { THEME_MAP, useThemeStore } from '../store/themeStore';
import { ThemePickerModal } from './ThemePickerModal';

interface ThemeQuickControlsProps {
  showEditorOptions?: boolean;
}

export function ThemeQuickControls({
  showEditorOptions = true,
}: ThemeQuickControlsProps) {
  const [open, setOpen] = useState(false);
  const presetId = useThemeStore((s) => s.presetId);
  const toggleLightDark = useThemeStore((s) => s.toggleLightDark);
  const currentPreset = THEME_MAP[presetId];
  const isDark = currentPreset.mode === 'dark';

  return (
    <>
      <div className="theme-quick-controls">
        <button
          type="button"
          className="icon-btn"
          onClick={toggleLightDark}
          title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {isDark ? (
            <Sun size={16} strokeWidth={1.5} />
          ) : (
            <Moon size={16} strokeWidth={1.5} />
          )}
        </button>

        <button
          type="button"
          className="icon-btn"
          onClick={() => setOpen(true)}
          title="Appearance & theme"
          aria-label="Appearance and theme"
        >
          <Palette size={16} strokeWidth={1.5} />
        </button>
      </div>

      {open && (
        <ThemePickerModal
          onClose={() => setOpen(false)}
          showEditorOptions={showEditorOptions}
        />
      )}
    </>
  );
}
