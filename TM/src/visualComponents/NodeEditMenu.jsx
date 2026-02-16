import React, { useState, useEffect } from "react";
import "../Visualiser.css";

export default function NodeEditMenu({ node, onClose, onSave }) {
  const originalName = node?.data?.label || "";
  const [name, setName] = useState(originalName);

  const isNameEmpty = name.trim() === "";

  // Allow saving with the "Enter" key
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !isNameEmpty) {
      handleSave();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  const handleSave = () => {
    if (!isNameEmpty) {
      onSave(node.id, name, node?.type);
      onClose();
    }
  };

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div 
        className="popup-menu" 
        style={{ maxWidth: '350px' }} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="popup-header">
          <h3>Edit Node</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="form-group">
          <label>Node Label:</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. S0, Accept, etc."
            autoFocus
          />
        </div>

        <div className="popup-actions">
          <button 
            className="window-toggle-btn" 
            style={{ backgroundColor: isNameEmpty ? '#f0f0f0' : '#e3f2fd', color: '#000000' }}
            onClick={handleSave} 
            disabled={isNameEmpty}
          >
            Save Changes
          </button>
          <button className="window-toggle-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}