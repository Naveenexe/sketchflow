import React, { useState } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { Sparkles, Share2, Download } from 'lucide-react';

export default function App() {
  const [boardTitle, setBoardTitle] = useState('Untitled Board');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'offline'>('saved');

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBoardTitle(e.target.value);
    setSaveStatus('saving');
    setTimeout(() => {
      setSaveStatus('saved');
    }, 600);
  };

  return (
    <div className="sketchflow-container">
      {/* Top Application Shell */}
      <header className="sketchflow-header">
        <div className="sketchflow-left-section">
          {/* SketchFlow Brand Identity */}
          <div className="sketchflow-brand" title="SketchFlow Collaborative Whiteboard">
            <div className="sketchflow-logo-icon">
              <Sparkles size={18} />
            </div>
            <span>SketchFlow</span>
          </div>

          <div className="sketchflow-divider" />

          {/* Board Title Input */}
          <div className="sketchflow-title-wrapper">
            <input
              type="text"
              className="sketchflow-title-input"
              value={boardTitle}
              onChange={handleTitleChange}
              placeholder="Board title..."
              aria-label="Board title"
            />
          </div>

          {/* Autosave Status Indicator */}
          <div className="sketchflow-save-indicator">
            <span
              className={`sketchflow-save-dot ${saveStatus === 'saving' ? 'saving' : saveStatus === 'offline' ? 'offline' : ''}`}
            />
            <span>{saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Offline'}</span>
          </div>
        </div>

        {/* Right Action Shell */}
        <div className="sketchflow-right-section">
          <div className="sketchflow-user-badge">
            <div className="sketchflow-avatar">SF</div>
            <span>Local User</span>
          </div>

          <button
            type="button"
            className="sketchflow-btn"
            onClick={() => alert('Export is built into the Excalidraw canvas menu (top-left burger icon).')}
            title="Export Board"
          >
            <Download size={15} />
            <span>Export</span>
          </button>

          <button
            type="button"
            className="sketchflow-btn sketchflow-btn-primary"
            onClick={() => alert('Real-time sharing will be enabled in Milestones 5 & 6 with your backend.')}
            title="Share Board"
          >
            <Share2 size={15} />
            <span>Share</span>
          </button>
        </div>
      </header>

      {/* Embedded Whiteboard Canvas */}
      <main className="sketchflow-canvas-wrapper">
        <Excalidraw
          name={boardTitle}
          UIOptions={{
            canvasActions: {
              saveToActiveFile: false,
              loadScene: true,
              toggleTheme: true,
            },
          }}
        />
      </main>
    </div>
  );
}
