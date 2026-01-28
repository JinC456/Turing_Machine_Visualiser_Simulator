import React, { useRef } from "react";

export default function DiagramControls({ 
  handleClearAll, 
  Undo, 
  Redo, 
  handleExport,
  handleImport,
  canUndo,
  canRedo 
}) {
  const fileInputRef = useRef(null);

  const onImportClick = () => {
    fileInputRef.current?.click();
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
    
    // Reset value so the same file can be selected again if needed
    e.target.value = "";
  };

  return (
    <div className="diagram-controls">
      <div className="history-controls">
        <button onClick={Undo} disabled={!canUndo}>↶</button>
        <button onClick={Redo} disabled={!canRedo}>↷</button>
      </div>
      <button onClick={handleClearAll}>Clear All</button>
      <button onClick={handleExport}>Export JSON</button>
      
      <button onClick={onImportClick}>Import JSON</button>
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