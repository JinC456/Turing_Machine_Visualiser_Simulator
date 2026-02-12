import React, { useState } from "react";
import "../Visualiser.css";

export default function NodeEditMenu({ node, onClose, onSave }) {
  const originalName = node?.data?.label || "";
  const [name, setName] = useState(originalName);

  const isNameEmpty = name.trim() === "";
  const hadOriginalName = originalName.trim() !== "";

  const handleSave = () => {
    if (!isNameEmpty) {
      onSave(node.id, name, node?.type);
      onClose();
    }
  };

  return (
    <div className="popup-overlay">
      <div className="popup-menu">
        <h3>Edit Node</h3>

        <label>Name:</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter node name"
        />

        <div className="popup-actions" >
          <button onClick={handleSave} disabled={isNameEmpty}>
            Save
          </button>

          {hadOriginalName && (
            <button onClick={onClose}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
