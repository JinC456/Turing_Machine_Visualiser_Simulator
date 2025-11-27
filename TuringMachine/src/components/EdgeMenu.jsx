import React, { useState } from "react";
import "../Visualiser.css";

export default function EdgeMenu({ edge, onClose, onSave, onDelete }) {
  const savedLabels = edge?.data?.labels || [];
  const [labels, setLabels] = useState(
    savedLabels.length > 0 ? savedLabels : [{ read: "", write: "", direction: "" }]
  );

  const updateLabel = (index, key, value) => {
    setLabels((prev) =>
      prev.map((lbl, i) => (i === index ? { ...lbl, [key]: value } : lbl))
    );
  };

  const addLabel = () =>
    setLabels((prev) => [...prev, { read: "", write: "", direction: "" }]);

  const removeLabel = (index) => {
    if (labels.length === 1) return;
    setLabels((prev) => prev.filter((_, i) => i !== index));
  };

  const hasValidRule = labels.some(
    (lbl) =>
      lbl.read.trim() !== "" &&
      lbl.write.trim() !== "" &&
      lbl.direction.trim() !== ""
  );

  const handleSave = () => {
    if (!hasValidRule) return;
    onSave(edge.id, labels);
    onClose();
  };

  const handleCancel = () => {
    if (!savedLabels || savedLabels.length === 0 || !savedLabels.some(
      lbl => lbl.read && lbl.write && lbl.direction
    )) {
      // No valid saved rules will delete edge
      onDelete(edge.id); 
    } else {
      // Revert to saved labels
      setLabels(savedLabels);
    }
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

            <button
              className="remove-button"
              onClick={() => removeLabel(index)}
              disabled={labels.length === 1}
            >
              Remove
            </button>
          </div>
        ))}

        <button className="add-label-button" onClick={addLabel}>
          Add Another rule
        </button>

        {!hasValidRule && (
          <p className="warning-text">
            You must fill in at least one rule to continue.
          </p>
        )}

        <div className="popup-actions">
          <button onClick={handleSave} disabled={!hasValidRule}>
            Save
          </button>
          <button onClick={handleCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
