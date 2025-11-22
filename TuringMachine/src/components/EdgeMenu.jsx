import React, { useState } from "react";
import "../Visualiser.css";

export default function EdgeMenu({ edge, onClose, onSave }) {
  const [labels, setLabels] = useState(edge?.data?.labels || []);

  // update a label at index
  const updateLabel = (index, key, value) => {
    setLabels((prev) =>
      prev.map((lbl, i) => (i === index ? { ...lbl, [key]: value } : lbl))
    );
  };

  // add a new empty label
  const addLabel = () =>
    setLabels((prev) => [...prev, { read: "", write: "", direction: "" }]);

  // remove a label
  const removeLabel = (index) =>
    setLabels((prev) => prev.filter((_, i) => i !== index));

  const handleSave = () => {
    onSave(edge.id, labels);
    onClose();
  };

  return (
    <div className="popup-overlay">
      <div className="popup-menu">
        <h3>Edit Edge</h3>

        {labels.map((label, index) => (
          <div key={index} className="label-row">
            <label>
              Read:
              <input
                type="text"
                value={label.read}
                onChange={(e) => updateLabel(index, "read", e.target.value)}
              />
            </label>

            <label>
              Write:
              <input
                type="text"
                value={label.write}
                onChange={(e) => updateLabel(index, "write", e.target.value)}
              />
            </label>

            <div className="direction-buttons">
              Direction:
              <button
                className={label.direction === "L" ? "selected" : ""}
                onClick={() => updateLabel(index, "direction", "L")}
              >
                Left
              </button>
              <button
                className={label.direction === "R" ? "selected" : ""}
                onClick={() => updateLabel(index, "direction", "R")}
              >
                Right
              </button>
            </div>

            <button className="remove-button" onClick={() => removeLabel(index)}>
              Remove
            </button>
          </div>
        ))}

        <button className="add-label-button" onClick={addLabel}>
          Add Label
        </button>

        <div className="popup-actions">
          <button onClick={handleSave}>Save</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
