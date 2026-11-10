import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark';

export type ThemePresetId =
  | 'paper'
  | 'sand'
  | 'sage'
  | 'slate'
  | 'clay'
  | 'mist'
  | 'graphite'
  | 'midnight'
  | 'forest'
  | 'ember';

export type CanvasStyle = 'plain' | 'dots' | 'tinted';

export interface ThemePreset {
  id: ThemePresetId;
  name: string;
  mode: ThemeMode;
  pair: ThemePresetId;
  bg: string;
  surface: string;
  accent: string;
  canvas: string;
  pen: string;
  ink: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'paper',
    name: 'Paper',
    mode: 'light',
    pair: 'graphite',
    bg: '#FAFAF9',
    surface: '#FFFFFF',
    accent: '#1C1917',
    canvas: '#FFFFFF',
    pen: '#1C1917',
    ink: '#1C1917',
  },
  {
    id: 'sand',
    name: 'Sand',
    mode: 'light',
    pair: 'ember',
    bg: '#F7F3EC',
    surface: '#FDFBF7',
    accent: '#8A6F47',
    canvas: '#FBF8F2',
    pen: '#3B2F1E',
    ink: '#2B2217',
  },
  {
    id: 'sage',
    name: 'Sage',
    mode: 'light',
    pair: 'forest',
    bg: '#F3F5F0',
    surface: '#FAFBF8',
    accent: '#5F7A61',
    canvas: '#F8FAF5',
    pen: '#243126',
    ink: '#1E2A20',
  },
  {
    id: 'slate',
    name: 'Slate',
    mode: 'light',
    pair: 'midnight',
    bg: '#F1F4F8',
    surface: '#FAFBFD',
    accent: '#4A6785',
    canvas: '#F7F9FC',
    pen: '#1E2A38',
    ink: '#1B2531',
  },
  {
    id: 'clay',
    name: 'Clay',
    mode: 'light',
    pair: 'ember',
    bg: '#F7F1EE',
    surface: '#FDFAF8',
    accent: '#A5604A',
    canvas: '#FBF7F4',
    pen: '#3A2219',
    ink: '#2E1B14',
  },
  {
    id: 'mist',
    name: 'Mist',
    mode: 'light',
    pair: 'midnight',
    bg: '#F4F2F8',
    surface: '#FBFAFD',
    accent: '#6E6590',
    canvas: '#F9F8FC',
    pen: '#2B2540',
    ink: '#231F35',
  },
  {
    id: 'graphite',
    name: 'Graphite',
    mode: 'dark',
    pair: 'paper',
    bg: '#161616',
    surface: '#1F1F1F',
    accent: '#E7E5E4',
    canvas: '#1A1A1A',
    pen: '#EDEDED',
    ink: '#F2F2F2',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    mode: 'dark',
    pair: 'slate',
    bg: '#0F1419',
    surface: '#171D25',
    accent: '#7C9CBF',
    canvas: '#121820',
    pen: '#E6EDF3',
    ink: '#EAF0F6',
  },
  {
    id: 'forest',
    name: 'Forest',
    mode: 'dark',
    pair: 'sage',
    bg: '#121613',
    surface: '#1A201B',
    accent: '#8DAA8F',
    canvas: '#151A16',
    pen: '#E4EBE5',
    ink: '#E9EFEA',
  },
  {
    id: 'ember',
    name: 'Ember',
    mode: 'dark',
    pair: 'sand',
    bg: '#1A1614',
    surface: '#231E1B',
    accent: '#C99A6B',
    canvas: '#1D1917',
    pen: '#EFE7DF',
    ink: '#F3ECE4',
  },
];

export const THEME_MAP: Record<ThemePresetId, ThemePreset> = THEME_PRESETS.reduce(
  (acc, t) => {
    acc[t.id] = t;
    return acc;
  },
  {} as Record<ThemePresetId, ThemePreset>
);

const STORAGE_KEY = 'sketchflow_theme';

interface PersistedTheme {
  presetId: ThemePresetId;
  customCanvas?: string;
  customPen?: string;
  sketchyStyle?: boolean;
  canvasStyle?: CanvasStyle;
  autoHideBar?: boolean;
}

function getDefaultPresetId(): ThemePresetId {
  try {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return 'graphite';
    }
  } catch {
    // ignore
  }
  return 'paper';
}

function loadThemeState(): PersistedTheme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedTheme>;
      if (parsed.presetId && parsed.presetId in THEME_MAP) {
        return {
          presetId: parsed.presetId,
          customCanvas: parsed.customCanvas,
          customPen: parsed.customPen,
          sketchyStyle: Boolean(parsed.sketchyStyle),
          canvasStyle:
            parsed.canvasStyle === 'dots' || parsed.canvasStyle === 'tinted'
              ? parsed.canvasStyle
              : 'plain',
          autoHideBar: Boolean(parsed.autoHideBar),
        };
      }
    }
  } catch {
    // ignore storage errors
  }
  return {
    presetId: getDefaultPresetId(),
    sketchyStyle: false,
    canvasStyle: 'plain',
    autoHideBar: false,
  };
}

function saveThemeState(data: PersistedTheme) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore storage errors
  }
}

function applyThemeToDom(
  presetId: ThemePresetId,
  customCanvas?: string,
  customPen?: string
) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', presetId);
  if (customCanvas) {
    root.style.setProperty('--canvas', customCanvas);
  } else {
    root.style.removeProperty('--canvas');
  }
  if (customPen) {
    root.style.setProperty('--pen', customPen);
  } else {
    root.style.removeProperty('--pen');
  }
}

function parseHexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  }
  return null;
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function getContrastRatio(hex1: string, hex2: string): number {
  const rgb1 = parseHexToRgb(hex1);
  const rgb2 = parseHexToRgb(hex2);
  if (!rgb1 || !rgb2) return 21;
  const l1 = relativeLuminance(rgb1);
  const l2 = relativeLuminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function isDarkColor(hex: string): boolean {
  const rgb = parseHexToRgb(hex);
  if (!rgb) return false;
  return relativeLuminance(rgb) < 0.35;
}

interface ThemeStoreState {
  presetId: ThemePresetId;
  customCanvas?: string;
  customPen?: string;
  sketchyStyle: boolean;
  canvasStyle: CanvasStyle;
  autoHideBar: boolean;
  setPreset: (presetId: ThemePresetId) => void;
  toggleLightDark: () => void;
  setCustomCanvas: (color: string) => void;
  setCustomPen: (color: string) => void;
  resetCustomColors: () => void;
  setSketchyStyle: (sketchy: boolean) => void;
  setCanvasStyle: (style: CanvasStyle) => void;
  setAutoHideBar: (autoHide: boolean) => void;
}

const initial = loadThemeState();
applyThemeToDom(initial.presetId, initial.customCanvas, initial.customPen);

export const useThemeStore = create<ThemeStoreState>((set, get) => {
  const persistCurrent = (next: Partial<PersistedTheme>) => {
    const s = get();
    const merged: PersistedTheme = {
      presetId: next.presetId ?? s.presetId,
      customCanvas:
        'customCanvas' in next ? next.customCanvas : s.customCanvas,
      customPen: 'customPen' in next ? next.customPen : s.customPen,
      sketchyStyle:
        next.sketchyStyle !== undefined ? next.sketchyStyle : s.sketchyStyle,
      canvasStyle: next.canvasStyle ?? s.canvasStyle,
      autoHideBar:
        next.autoHideBar !== undefined ? next.autoHideBar : s.autoHideBar,
    };
    saveThemeState(merged);
  };

  return {
    presetId: initial.presetId,
    customCanvas: initial.customCanvas,
    customPen: initial.customPen,
    sketchyStyle: Boolean(initial.sketchyStyle),
    canvasStyle: initial.canvasStyle || 'plain',
    autoHideBar: Boolean(initial.autoHideBar),

    setPreset: (presetId) => {
      const { customCanvas, customPen } = get();
      applyThemeToDom(presetId, customCanvas, customPen);
      set({ presetId });
      persistCurrent({ presetId });
    },

    toggleLightDark: () => {
      const current = THEME_MAP[get().presetId] || THEME_MAP.paper;
      const nextId = current.pair;
      const { customCanvas, customPen } = get();
      applyThemeToDom(nextId, customCanvas, customPen);
      set({ presetId: nextId });
      persistCurrent({ presetId: nextId });
    },

    setCustomCanvas: (color) => {
      const { presetId, customPen } = get();
      applyThemeToDom(presetId, color, customPen);
      set({ customCanvas: color });
      persistCurrent({ customCanvas: color });
    },

    setCustomPen: (color) => {
      const { presetId, customCanvas } = get();
      applyThemeToDom(presetId, customCanvas, color);
      set({ customPen: color });
      persistCurrent({ customPen: color });
    },

    resetCustomColors: () => {
      const { presetId } = get();
      applyThemeToDom(presetId, undefined, undefined);
      set({ customCanvas: undefined, customPen: undefined });
      persistCurrent({ customCanvas: undefined, customPen: undefined });
    },

    setSketchyStyle: (sketchyStyle) => {
      set({ sketchyStyle });
      persistCurrent({ sketchyStyle });
    },

    setCanvasStyle: (canvasStyle) => {
      set({ canvasStyle });
      persistCurrent({ canvasStyle });
    },

    setAutoHideBar: (autoHideBar) => {
      set({ autoHideBar });
      persistCurrent({ autoHideBar });
    },
  };
});

