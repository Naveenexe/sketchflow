import { isDarkColor, THEME_PRESETS } from '../store/themeStore';

const THEME_CANVAS_HEXES = new Set([
  '#ffffff',
  ...THEME_PRESETS.map((p) => p.canvas.toLowerCase()),
]);

const NEUTRAL_DARK_INKS = new Set([
  '#000000',
  '#1e1e1e',
  ...THEME_PRESETS.filter((p) => p.mode === 'light').map((p) =>
    p.pen.toLowerCase()
  ),
]);

const NEUTRAL_LIGHT_INKS = new Set([
  '#ffffff',
  '#f2f2f2',
  ...THEME_PRESETS.filter((p) => p.mode === 'dark').map((p) =>
    p.pen.toLowerCase()
  ),
]);

export function resolveBoardBackground(
  savedBg: string | undefined,
  activeCanvas: string,
  forceApply = false
): string {
  if (
    forceApply ||
    !savedBg ||
    savedBg === 'transparent' ||
    THEME_CANVAS_HEXES.has(savedBg.toLowerCase())
  ) {
    return activeCanvas;
  }
  return savedBg;
}

export function adaptElementsForCanvas<T extends Record<string, unknown>>(
  elements: readonly T[],
  targetCanvas: string,
  targetPen: string
): T[] {
  const darkCanvas = isDarkColor(targetCanvas);
  let changed = false;

  const mapped = elements.map((el) => {
    if (el.isDeleted || typeof el.strokeColor !== 'string') {
      return el;
    }

    const bgColor =
      typeof el.backgroundColor === 'string'
        ? el.backgroundColor.toLowerCase()
        : 'transparent';
    if (bgColor !== 'transparent') {
      return el;
    }

    const stroke = el.strokeColor.toLowerCase();
    const shouldSwap = darkCanvas
      ? NEUTRAL_DARK_INKS.has(stroke)
      : NEUTRAL_LIGHT_INKS.has(stroke);

    if (!shouldSwap || stroke === targetPen.toLowerCase()) {
      return el;
    }

    changed = true;
    return {
      ...el,
      strokeColor: targetPen,
    };
  });

  return changed ? mapped : (elements as T[]);
}

export function isSafeEmbeddableUrl(link: string): boolean {
  try {
    const parsed = new URL(link);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

