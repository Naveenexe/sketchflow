import React, { useRef, useState } from 'react';
import { exportToBlob, exportToSvg } from '@excalidraw/excalidraw';
import { X, Image, FileCode, FileJson, Upload, AlertCircle } from 'lucide-react';

interface ExportModalProps {
  boardTitle: string;
  canImport: boolean;
  getSceneData: () => {
    elements: readonly unknown[];
    appState: Record<string, unknown>;
    files: Record<string, unknown>;
  } | null;
  onImportScene: (elements: readonly unknown[], appState: Record<string, unknown>) => void;
  onClose: () => void;
}

const MAX_IMPORT_BYTES = 5 * 1024 * 1024; // 5 MB limit per SRS 3.6 & 4.3

function sanitizeFilename(title: string) {
  return (title || 'sketchflow-board')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-|-$/g, '');
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ExportModal({
  boardTitle,
  canImport,
  getSceneData,
  onImportScene,
  onClose,
}: ExportModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const safeName = sanitizeFilename(boardTitle);

  const handleExportPng = async () => {
    const data = getSceneData();
    if (!data) return;
    setExporting(true);
    setError(null);
    try {
      const blob = await exportToBlob({
        elements: data.elements as Parameters<typeof exportToBlob>[0]['elements'],
        appState: {
          ...data.appState,
          exportWithDarkMode: false,
        } as Parameters<typeof exportToBlob>[0]['appState'],
        files: data.files as Parameters<typeof exportToBlob>[0]['files'],
      });
      triggerDownload(blob, `${safeName}.png`);
      onClose();
    } catch {
      setError('Failed to export PNG image.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportSvg = async () => {
    const data = getSceneData();
    if (!data) return;
    setExporting(true);
    setError(null);
    try {
      const svg = await exportToSvg({
        elements: data.elements as Parameters<typeof exportToSvg>[0]['elements'],
        appState: data.appState as Parameters<typeof exportToSvg>[0]['appState'],
        files: data.files as Parameters<typeof exportToSvg>[0]['files'],
      });
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svg);
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      triggerDownload(blob, `${safeName}.svg`);
      onClose();
    } catch {
      setError('Failed to export SVG vector.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportJson = () => {
    const data = getSceneData();
    if (!data) return;
    const payload = {
      type: 'excalidraw',
      version: 2,
      source: 'sketchflow',
      elements: data.elements,
      appState: {
        viewBackgroundColor: data.appState?.viewBackgroundColor || '#ffffff',
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    triggerDownload(blob, `${safeName}.sketchflow.json`);
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.size > MAX_IMPORT_BYTES) {
      setError('Import failed: File exceeds the 5 MB safety limit.');
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as {
        elements?: unknown;
        appState?: Record<string, unknown>;
      };

      if (!parsed || !Array.isArray(parsed.elements)) {
        setError('Invalid scene file: Missing Excalidraw elements array.');
        return;
      }

      const appState = { ...(parsed.appState || {}) };
      delete appState.collaborators;

      onImportScene(parsed.elements, appState);
      onClose();
    } catch {
      setError('Invalid JSON file. Please choose a valid Excalidraw/SketchFlow JSON backup.');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Export &amp; Backup</h2>
            <p>Download your board or restore from a JSON backup.</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="auth-error" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <div className="export-grid">
          <button
            type="button"
            className="export-option-btn"
            onClick={handleExportPng}
            disabled={exporting}
          >
            <Image size={22} color="#6366f1" />
            <div>
              <div className="export-option-title">PNG Image</div>
              <div className="export-option-desc">High-resolution raster image</div>
            </div>
          </button>

          <button
            type="button"
            className="export-option-btn"
            onClick={handleExportSvg}
            disabled={exporting}
          >
            <FileCode size={22} color="#8b5cf6" />
            <div>
              <div className="export-option-title">SVG Vector</div>
              <div className="export-option-desc">Scalable vector graphic</div>
            </div>
          </button>

          <button
            type="button"
            className="export-option-btn"
            onClick={handleExportJson}
            disabled={exporting}
          >
            <FileJson size={22} color="#10b981" />
            <div>
              <div className="export-option-title">Portable JSON Backup</div>
              <div className="export-option-desc">Save raw scene data locally</div>
            </div>
          </button>

          {canImport && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.excalidraw"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <button
                type="button"
                className="export-option-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={exporting}
              >
                <Upload size={22} color="#f59e0b" />
                <div>
                  <div className="export-option-title">Import JSON Backup</div>
                  <div className="export-option-desc">Validated up to 5 MB</div>
                </div>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
