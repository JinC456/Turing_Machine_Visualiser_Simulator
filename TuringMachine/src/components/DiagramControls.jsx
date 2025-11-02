import React from "react";

export default function DiagramControls({ handleClearAll }) {
  return (
    <div className="diagram-controls">
      <button onClick={handleClearAll}>Clear All</button>
    </div>
  );
}
