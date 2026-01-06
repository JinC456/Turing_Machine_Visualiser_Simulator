import React from "react";

export default function DiagramControls({ handleClearAll, Undo, Redo, handleExport }) {
  return (
    <div className="diagram-controls">
      <div className="history-controls">
        <button onClick={Undo}>↶</button>
        <button onClick={Redo}>↷</button>
      </div>
      <button onClick={handleClearAll}>Clear All</button>
      <button onClick={handleExport}>Export JSON</button>
    </div>
  );
}