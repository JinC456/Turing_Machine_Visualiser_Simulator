import React, { useState } from "react";
import "../Visualiser.css";

export default function EdgeMenu({ 
  edge, 
  onClose, 
  onSave, 
  onDelete, 
  engine, 
  globalTapeCount = 2 
}) {
  const isMultiTape = engine === "MultiTape";
  const savedLabels = edge?.data?.labels || [];

  // Track pending operations to replay globally on save
  // items: { type: 'ADD' } or { type: 'DELETE', index: number }
  const [pendingOps, setPendingOps] = useState([]);

  // Determine local tape count from existing data or global default
  const getInitialTapeCount = () => {
    if (savedLabels.length > 0) {
      let max = 2;
      savedLabels.forEach(l => {
          Object.keys(l).forEach(k => {
              if (k.startsWith('tape')) {
                  const num = parseInt(k.replace('tape', ''), 10);
                  if (!isNaN(num)) max = Math.max(max, num);
              }
          });
      });
      return Math.max(globalTapeCount, max);
    }
    return Math.max(2, globalTapeCount);
  };

  const [tapeCount, setTapeCount] = useState(() => isMultiTape ? getInitialTapeCount() : 1);

  // Initialize Labels
  const [labels, setLabels] = useState(() => {
    if (savedLabels.length > 0) {
        return savedLabels; 
    }
    
    // Case B: New Edge - Start Fully Blank
    if (isMultiTape) {
      const newLabel = {};
      for(let i=1; i<=tapeCount; i++) {
          newLabel[`tape${i}`] = { read: "", write: "", direction: "" };
      }
      return [newLabel];
    }
    
    return [{ read: "", write: "", direction: "" }];
  });

  // --- ACTIONS ---

  const handleAddTape = () => {
    const newCount = tapeCount + 1;
    setTapeCount(newCount);
    const newKey = `tape${newCount}`;
    
    // Queue Operation
    setPendingOps(prev => [...prev, { type: 'ADD' }]);

    // Update Local UI: Add default rules (*, *, N)
    setLabels(prev => prev.map(lbl => ({
        ...lbl,
        [newKey]: { read: "␣", write: "␣", direction: "N" }
    })));
  };

  const handleDeleteTape = (tapeNumToDelete) => {
    if (tapeCount <= 2) return; 
    
    // Queue Operation: Delete at current index
    setPendingOps(prev => [...prev, { type: 'DELETE', index: tapeNumToDelete }]);

    setTapeCount(prev => prev - 1);
    
    // Update Local UI: Shift tapes down
    setLabels(prev => prev.map(lbl => {
        const newLbl = {};
        
        // Copy non-tape keys
        Object.keys(lbl).forEach(k => {
            if (!k.startsWith('tape')) newLbl[k] = lbl[k];
        });

        let newIndex = 1;
        // Re-index remaining tapes
        for (let i = 1; i <= tapeCount; i++) {
            if (i === tapeNumToDelete) continue; // Skip deleted
            
            const oldKey = `tape${i}`;
            const newKey = `tape${newIndex}`;
            
            // Copy data if exists, else init blank
            if (lbl[oldKey]) {
                newLbl[newKey] = lbl[oldKey];
            } else {
                 newLbl[newKey] = { read: "", write: "", direction: "" };
            }
            newIndex++;
        }
        return newLbl;
    }));
  };

  // --- FIELD UPDATES ---

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
            ...lbl[tapeKey] || { read: "", write: "", direction: "" },
            [field]: value
          }
        };
      })
    );
  };

  const toggleBlank = (index, field, currentVal, tapeKey = null) => {
  // If current value is blank, clear it; otherwise set to "␣"
  const newVal = currentVal === "␣" ? "" : "␣";
  if (tapeKey) {
    updateMultiLabel(index, tapeKey, field, newVal);
  } else {
    updateLabel(index, field, newVal);
  }
  };

  const addLabel = () => {
    if (isMultiTape) {
      const newLabel = {};
      for(let i=1; i<=tapeCount; i++) {
          newLabel[`tape${i}`] = { read: "", write: "", direction: "" };
      }
      setLabels((prev) => [...prev, newLabel]);
    } else {
      setLabels((prev) => [...prev, { read: "", write: "", direction: "" }]);
    }
  };

  const removeLabel = (index) => {
    if (labels.length === 1) return;
    setLabels((prev) => prev.filter((_, i) => i !== index));
  };

  // --- VALIDATION ---
  // All boxes must have content to save
  const hasValidRule = labels.every((lbl) => {
    if (isMultiTape) {
      for (let i = 1; i <= tapeCount; i++) {
          const t = lbl[`tape${i}`];
          if (!t) return false;
          // Check that Read, Write, and Direction are NOT empty strings
          if (t.read === "" || t.write === "" || t.direction === "") return false;
      }
      return true;
    } else {
      return (
        lbl.read !== "" &&
        lbl.write !== "" &&
        lbl.direction !== ""
      );
    }
  });

  const handleSave = () => {
    if (!hasValidRule) return;
    // Pass pending operations to parent for global sync
    onSave(edge.id, labels, pendingOps);
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

  const DirectionButton = ({ selected, onClick, text }) => (
    <button
      className={selected ? "selected" : ""}
      onClick={onClick}
      style={{ flex: 1, padding: "4px", minWidth: "30px" }} 
    >
      {text}
    </button>
  );

  return (
    <div className="popup-overlay">
      <div className="popup-menu" style={{ maxWidth: isMultiTape ? '90vw' : '320px', width: 'auto' }}>
        <h3>Edit Edge {isMultiTape }</h3>
        <h4>check box to indicate blank</h4>

        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        {labels.map((label, index) => (
          <div key={index} className="label-row" style={{ borderBottom: "2px solid #ccc", paddingBottom: "15px", marginBottom: "15px" }}>
            
            {!isMultiTape && (
              <>
                <label>
                  Read:
                  <input type="text" value={label.read} onChange={(e) => updateLabel(index, "read", e.target.value)} />
                  <input 
                    type="checkbox" 
                    checked={label.read === "␣"} 
                    onChange={() => toggleBlank(index, "read", label.read)} 
                  /> 
                </label>
                <label>
                  Write:
                  <input type="text" value={label.write} onChange={(e) => updateLabel(index, "write", e.target.value)} />
                  <input 
                    type="checkbox" 
                    checked={label.write === "␣"} 
                    onChange={() => toggleBlank(index, "write", label.write)} 
                  /> 
                </label>
                <div className="direction-buttons">
                  <DirectionButton selected={label.direction === "L"} onClick={() => updateLabel(index, "direction", "L")} text="L" />
                  <DirectionButton selected={label.direction === "N"} onClick={() => updateLabel(index, "direction", "N")} text="None" />
                  <DirectionButton selected={label.direction === "R"} onClick={() => updateLabel(index, "direction", "R")} text="R" />
                </div>
              </>
            )}

            {isMultiTape && (
              <div style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '10px' }}>
                {Array.from({ length: tapeCount }).map((_, i) => {
                    const tapeNum = i + 1;
                    const key = `tape${tapeNum}`;
                    const tapeData = label[key] || { read: "", write: "", direction: "" };
                    
                    // Show delete 'X' ONLY if more than 2 tapes
                    const showDelete = tapeCount > 2;

                    return (
                        <div key={key} style={{ minWidth: '150px', borderRight: i < tapeCount-1 ? '1px solid #ccc' : 'none', paddingRight: '15px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                <h5 style={{ margin: 0 }}>Tape {tapeNum}</h5>
                                {showDelete && (
                                    <button 
                                        onClick={() => handleDeleteTape(tapeNum)}
                                        title="Delete this tape (Saved on close)"
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: '#d9534f',
                                            cursor: 'pointer',
                                            fontSize: '1.2rem',
                                            fontWeight: 'bold',
                                            padding: '0 5px',
                                            lineHeight: '1'
                                        }}
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                            
                            <label>Read:
                              <input type="text" value={tapeData.read} onChange={(e) => updateMultiLabel(index, key, "read", e.target.value)} />
                              <input 
                                type="checkbox" 
                                checked={tapeData.read === "␣"} 
                                onChange={() => toggleBlank(index, "read", tapeData.read, key)} 
                              /> 
                            </label>

                            <label>Write:
                              <input type="text" value={tapeData.write} onChange={(e) => updateMultiLabel(index, key, "write", e.target.value)} />
                              <input 
                                type="checkbox" 
                                checked={tapeData.write === "␣"} 
                                onChange={() => toggleBlank(index, "write", tapeData.write, key)} 
                              /> 
                            </label>
                            <div className="direction-buttons" style={{ marginTop: '5px' }}>
                                <DirectionButton selected={tapeData.direction === "L"} onClick={() => updateMultiLabel(index, key, "direction", "L")} text="L" />
                                <DirectionButton selected={tapeData.direction === "N"} onClick={() => updateMultiLabel(index, key, "direction", "N")} text="N" />
                                <DirectionButton selected={tapeData.direction === "R"} onClick={() => updateMultiLabel(index, key, "direction", "R")} text="R" />
                            </div>
                        </div>
                    );
                })}
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

        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button className="add-label-button" onClick={addLabel}>
            Add new rule
            </button>
            
            {isMultiTape && (
                <button 
                  className="add-label-button" 
                  onClick={handleAddTape} 
                  style={{ backgroundColor: '#e2e6ea' }}
                >
                  + Add Tape
                </button>
            )}
        </div>

        {!hasValidRule && (
          <p className="warning-text" style={{ visibility: hasValidRule ? 'hidden' : 'visible' }}>
            All boxes (Read, Write, Direction) must be filled to save.
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