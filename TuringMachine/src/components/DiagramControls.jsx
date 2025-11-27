import React from "react";

export default function DiagramControls({ handleClearAll,Undo,Redo }) {
  return (
    <div className="diagram-controls">
      <button onClick={handleClearAll}>Clear All</button>
      <button onClick={Undo}>↶</button>
      <button onClick={Redo}>↷</button>
    </div>
  );
}
