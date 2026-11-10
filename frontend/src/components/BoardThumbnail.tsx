import { useMemo } from 'react';

interface BoardThumbnailProps {
  boardId: string;
  sceneJson?: string;
}

interface RawElement {
  type?: string;
  isDeleted?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  points?: number[][];
}

function getCachedThumbnail(boardId: string): string | null {
  try {
    return localStorage.getItem(`sketchflow_thumb_${boardId}`);
  } catch {
    return null;
  }
}

export function BoardThumbnail({ boardId, sceneJson }: BoardThumbnailProps) {
  const cachedPng = getCachedThumbnail(boardId);

  const parsedPreview = useMemo(() => {
    if (!sceneJson) return null;
    try {
      const parsed = JSON.parse(sceneJson) as {
        elements?: RawElement[];
        appState?: { viewBackgroundColor?: string };
      };
      const elements = (parsed.elements || []).filter(
        (el) => !el.isDeleted && typeof el.x === 'number' && typeof el.y === 'number'
      );
      if (elements.length === 0) return null;

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const el of elements) {
        const x = el.x || 0;
        const y = el.y || 0;
        const w = el.width || 24;
        const h = el.height || 24;
        minX = Math.min(minX, x, x + w);
        minY = Math.min(minY, y, y + h);
        maxX = Math.max(maxX, x, x + w);
        maxY = Math.max(maxY, y, y + h);
      }

      const spanW = Math.max(maxX - minX, 80);
      const spanH = Math.max(maxY - minY, 60);
      const pad = Math.max(spanW, spanH) * 0.14;

      return {
        viewBox: `${minX - pad} ${minY - pad} ${spanW + pad * 2} ${spanH + pad * 2}`,
        strokeWidth: Math.max(spanW, spanH) / 140,
        elements: elements.slice(0, 60),
      };
    } catch {
      return null;
    }
  }, [sceneJson]);

  if (cachedPng) {
    return (
      <div className="board-thumb-frame">
        <img
          src={cachedPng}
          alt=""
          className="board-thumb-img"
          loading="lazy"
        />
      </div>
    );
  }

  if (parsedPreview) {
    return (
      <div className="board-thumb-frame" aria-hidden="true">
        <svg
          className="board-thumb-svg"
          viewBox={parsedPreview.viewBox}
          preserveAspectRatio="xMidYMid meet"
        >
          {parsedPreview.elements.map((el, idx) => {
            const x = el.x || 0;
            const y = el.y || 0;
            const w = el.width || 0;
            const h = el.height || 0;
            const sw = parsedPreview.strokeWidth;

            if (el.type === 'ellipse') {
              return (
                <ellipse
                  key={idx}
                  cx={x + w / 2}
                  cy={y + h / 2}
                  rx={Math.abs(w) / 2}
                  ry={Math.abs(h) / 2}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={sw}
                />
              );
            }
            if (el.type === 'diamond') {
              const cx = x + w / 2;
              const cy = y + h / 2;
              return (
                <polygon
                  key={idx}
                  points={`${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={sw}
                />
              );
            }
            if (
              (el.type === 'line' || el.type === 'arrow' || el.type === 'freedraw') &&
              Array.isArray(el.points) &&
              el.points.length > 1
            ) {
              const d = el.points
                .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${x + pt[0]} ${y + pt[1]}`)
                .join(' ');
              return (
                <path
                  key={idx}
                  d={d}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={sw}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            }
            if (el.type === 'text') {
              return (
                <line
                  key={idx}
                  x1={x}
                  y1={y + Math.max(h, 12) / 2}
                  x2={x + Math.max(w, 40)}
                  y2={y + Math.max(h, 12) / 2}
                  stroke="currentColor"
                  strokeWidth={sw * 1.4}
                  strokeLinecap="round"
                />
              );
            }
            return (
              <rect
                key={idx}
                x={Math.min(x, x + w)}
                y={Math.min(y, y + h)}
                width={Math.abs(w) || 24}
                height={Math.abs(h) || 24}
                rx={sw * 1.5}
                fill="none"
                stroke="currentColor"
                strokeWidth={sw}
              />
            );
          })}
        </svg>
      </div>
    );
  }

  return (
    <div className="board-thumb-frame board-thumb-empty" aria-hidden="true">
      <div className="board-thumb-empty-dots" />
    </div>
  );
}

