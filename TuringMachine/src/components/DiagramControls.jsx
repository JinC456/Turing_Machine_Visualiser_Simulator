import React from 'react';

export default function DiagramControls({ handleClearAll }) {
  return (
    <div className="diagram-controls">
      <button>Save</button>
      <button>Delete</button>
      <button onClick={handleClearAll}>Clear all</button>
    </div>
  );
}
