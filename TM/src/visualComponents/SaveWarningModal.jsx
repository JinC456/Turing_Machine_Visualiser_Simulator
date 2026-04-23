import React, { useState } from "react";
import "../Visualiser.css";

export default function SaveWarningModal({ onConfirm, onCancel }) {
  const [dontAskAgain, setDontAskAgain] = useState(false);

  const handleConfirm = () => {
    if (dontAskAgain) {
      localStorage.setItem("skipSaveWarning", "true");
    }
    onConfirm();
  };

  return (
    <div className="save-warning-overlay" onClick={onCancel}>
      <div
        className="save-warning-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-warning-title"
      >

        <h2 id="save-warning-title" className="save-warning-title">
          Unsaved Work
        </h2>

        <p className="save-warning-body">
          Changing the engine will erase your current diagram. Make sure you
          have exported your work before continuing.
        </p>

        <label className="save-warning-checkbox-label">
          <input
            type="checkbox"
            checked={dontAskAgain}
            onChange={(e) => setDontAskAgain(e.target.checked)}
          />
          Don't ask me again
        </label>

        <div className="save-warning-actions">
          <button className="save-warning-btn cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="save-warning-btn confirm" onClick={handleConfirm}>
            Proceed Anyway
          </button>
        </div>
      </div>
    </div>
  );
}