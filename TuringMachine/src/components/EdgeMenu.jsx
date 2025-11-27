import React, { useState } from "react";
import "../Visualiser.css";

export default function EdgeMenu({ edge, onClose, onSave }) {
  const [labels, setLabels] = useState(() => {
    const existing = edge?.data?.labels || [];
    return existing.length > 0 ? existing : [{ read: "", write: "", direction: "" }];
  });

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

  // A valid rule has all three fields filled
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
          <button onClick={onClose} disabled={!hasValidRule}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
