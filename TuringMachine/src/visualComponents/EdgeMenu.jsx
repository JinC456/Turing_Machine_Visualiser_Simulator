import React, { useState } from "react";
import "../Visualiser.css";

export default function EdgeMenu({ edge, onClose, onSave, onDelete, engine }) {
  const isMultiTape = engine === "MultiTape";
  const savedLabels = edge?.data?.labels || [];

  // Initialize state based on engine mode
  const [labels, setLabels] = useState(() => {
    if (savedLabels.length > 0) return savedLabels;
    
    if (isMultiTape) {
      return [{ 
        tape1: { read: "", write: "", direction: "" }, 
        tape2: { read: "", write: "", direction: "" } 
      }];
    }
    return [{ read: "", write: "", direction: "" }];
  });

  const updateLabel = (index, key, value) => {
    setLabels((prev) =>
      prev.map((lbl, i) => (i === index ? { ...lbl, [key]: value } : lbl))
    );
  };

  const updateMultiLabel = (index, tapeKey, field, value) => {
    setLabels((prev) =>
      prev.map((lbl, i) => {
        if (i !== index) return lbl;
        return {
          ...lbl,
          [tapeKey]: {
            ...lbl[tapeKey],
            [field]: value
          }
        };
      })
    );
  };

  const addLabel = () => {
    if (isMultiTape) {
      setLabels((prev) => [
        ...prev, 
        { 
          tape1: { read: "", write: "", direction: "" }, 
          tape2: { read: "", write: "", direction: "" } 
        }
      ]);
    } else {
      setLabels((prev) => [...prev, { read: "", write: "", direction: "" }]);
    }
  };

  const removeLabel = (index) => {
    if (labels.length === 1) return;
    setLabels((prev) => prev.filter((_, i) => i !== index));
  };

  // Validation
  const hasValidRule = labels.some((lbl) => {
    if (isMultiTape) {
      // Must have T1 rules AND T2 rules filled
      const t1Valid = lbl.tape1?.read.trim() !== "" && lbl.tape1?.write.trim() !== "" && lbl.tape1?.direction.trim() !== "";
      const t2Valid = lbl.tape2?.read.trim() !== "" && lbl.tape2?.write.trim() !== "" && lbl.tape2?.direction.trim() !== "";
      return t1Valid && t2Valid;
    } else {
      return (
        lbl.read?.trim() !== "" &&
        lbl.write?.trim() !== "" &&
        lbl.direction?.trim() !== ""
      );
    }
  });

  const handleSave = () => {
    if (!hasValidRule) return;
    onSave(edge.id, labels);
    onClose();
  };

  const handleCancel = () => {
    if (!savedLabels || savedLabels.length === 0) {
       onDelete(edge.id); 
    } else {
       setLabels(savedLabels);
    }
    onClose();
  };

  // --- RENDER HELPERS ---
  const DirectionButton = ({ selected, onClick, text }) => (
    <button
      className={selected ? "selected" : ""}
      onClick={onClick}
      style={{ flex: 1, padding: "4px" }} 
    >
      {text}
    </button>
  );

  return (
    <div className="popup-overlay">
      <div className="popup-menu" style={{ maxWidth: isMultiTape ? '500px' : '320px' }}>
        <h3>Edit Edge {isMultiTape && "(Multi-Tape)"}</h3>
        <h4>Use * to indicate blank</h4>

        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        {labels.map((label, index) => (
          <div key={index} className="label-row" style={{ borderBottom: "2px solid #ccc", paddingBottom: "15px", marginBottom: "15px" }}>
            
            {/* --- SINGLE TAPE UI --- */}
            {!isMultiTape && (
              <>
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
                  <DirectionButton 
                    selected={label.direction === "L"} 
                    onClick={() => updateLabel(index, "direction", "L")} 
                    text="Left" 
                  />
                  {/* NEW: None Button */}
                  <DirectionButton 
                    selected={label.direction === "N"} 
                    onClick={() => updateLabel(index, "direction", "N")} 
                    text="None" 
                  />
                  <DirectionButton 
                    selected={label.direction === "R"} 
                    onClick={() => updateLabel(index, "direction", "R")} 
                    text="Right" 
                  />
                </div>
              </>
            )}

            {/* --- MULTI TAPE UI --- */}
            {isMultiTape && (
              <div style={{ display: 'flex', gap: '15px' }}>
                {/* TAPE 1 COLUMN */}
                <div style={{ flex: 1 }}>
                  <h5 style={{ margin: "0 0 5px 0" }}>Tape 1</h5>
                  <label>Read:
                    <input type="text" value={label.tape1.read} onChange={(e) => updateMultiLabel(index, "tape1", "read", e.target.value)} />
                  </label>
                  <label>Write:
                    <input type="text" value={label.tape1.write} onChange={(e) => updateMultiLabel(index, "tape1", "write", e.target.value)} />
                  </label>
                  <div className="direction-buttons" style={{ marginTop: '5px' }}>
                    <DirectionButton selected={label.tape1.direction === "L"} onClick={() => updateMultiLabel(index, "tape1", "direction", "L")} text="L" />
                    {/* NEW: N Button */}
                    <DirectionButton selected={label.tape1.direction === "N"} onClick={() => updateMultiLabel(index, "tape1", "direction", "N")} text="N" />
                    <DirectionButton selected={label.tape1.direction === "R"} onClick={() => updateMultiLabel(index, "tape1", "direction", "R")} text="R" />
                  </div>
                </div>
                
                {/* DIVIDER */}
                <div style={{ width: '1px', background: '#ccc' }}></div>

                {/* TAPE 2 COLUMN */}
                <div style={{ flex: 1 }}>
                  <h5 style={{ margin: "0 0 5px 0" }}>Tape 2</h5>
                  <label>Read:
                    <input type="text" value={label.tape2.read} onChange={(e) => updateMultiLabel(index, "tape2", "read", e.target.value)} />
                  </label>
                  <label>Write:
                    <input type="text" value={label.tape2.write} onChange={(e) => updateMultiLabel(index, "tape2", "write", e.target.value)} />
                  </label>
                  <div className="direction-buttons" style={{ marginTop: '5px' }}>
                    <DirectionButton selected={label.tape2.direction === "L"} onClick={() => updateMultiLabel(index, "tape2", "direction", "L")} text="L" />
                    {/* NEW: N Button */}
                    <DirectionButton selected={label.tape2.direction === "N"} onClick={() => updateMultiLabel(index, "tape2", "direction", "N")} text="N" />
                    <DirectionButton selected={label.tape2.direction === "R"} onClick={() => updateMultiLabel(index, "tape2", "direction", "R")} text="R" />
                  </div>
                </div>
              </div>
            )}

            <button
              className="remove-button"
              onClick={() => removeLabel(index)}
              disabled={labels.length === 1}
              style={{ marginTop: '10px' }}
            >
              Remove Rule
            </button>
          </div>
        ))}
        </div>

        <button className="add-label-button" onClick={addLabel}>
          Add new rule
        </button>

        {!hasValidRule && (
          <p className="warning-text">
            All fields must be filled for valid transition.
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