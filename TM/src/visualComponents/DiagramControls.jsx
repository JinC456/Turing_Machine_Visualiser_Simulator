import React, { useRef } from "react";

export default function DiagramControls({ 
  handleClearAll, 
  Undo, 
  Redo, 
  handleExport,
  handleImport,
  canUndo,
  canRedo,
  isLocked // NEW PROP
}) {
  const fileInputRef = useRef(null);

  const onImportClick = () => {
    if (!isLocked) {
        fileInputRef.current?.click();
    }
  };

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        handleImport(json);
      } catch (err) {
        console.error("Error parsing JSON:", err);
        alert("Failed to load file. Please ensure it is a valid JSON file.");
      }
    };
    reader.readAsText(file);
    
    e.target.value = "";
  };

  return (
    <div className="diagram-controls">
      <div className="history-controls">
        <button onClick={Undo} disabled={!canUndo || isLocked}>↶</button>
        <button onClick={Redo} disabled={!canRedo || isLocked}>↷</button>
      </div>
      
      <button 
        onClick={handleClearAll} 
        disabled={isLocked} // Grey out when locked
        style={isLocked ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
      >
        Clear All
      </button>

      <button onClick={handleExport} disabled={isLocked}>
        Export JSON
      </button>
      
      <button onClick={onImportClick} disabled={isLocked}>
        Import JSON
      </button>
      
      <input 
        type="file" 
        accept=".json"
        ref={fileInputRef}
        style={{ display: "none" }}
        onChange={onFileChange}
      />
    </div>
  );
}