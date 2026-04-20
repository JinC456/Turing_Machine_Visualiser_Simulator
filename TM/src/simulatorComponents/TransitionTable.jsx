/* src/simulatorComponents/TransitionTable.jsx */
import React, { useMemo, useState, useRef, useEffect } from "react";
import "../Visualiser.css";
import { getNodeLabel } from "./engines/Deterministic";

// --- REGEX VALIDATION ---
const DTMRegex       = /^[^,\s],\s*(L|R),\s*[^,\s]+$/;
const NTMRegex       = /^([^,\s],\s*(L|R|N),\s*[^,\s]+)(\s*\|\s*[^,\s],\s*(L|R|N),\s*[^,\s]+)*$/;
const multiRegex     = /^\(\s*[^,\s],\s*(L|R|N)(\s*:\s*[^,\s],\s*(L|R|N))*\s*\)\s*->\s*[^,\s]+$/;

// List-view per-field regexes
const stateRegex     = /^[^\s,|:()]+$/;
const readRegex      = /^[^,\s:]\s*:\s*[^,\s:](\s*:\s*[^,\s:])*$/;
const writeRegex     = /^[^,\s]\s*,\s*[^,\s](\s*,\s*[^,\s])*$/;
const directionRegex = /^(L|R|N)\s*,\s*(L|R|N)(\s*,\s*(L|R|N))*$/;

function getListFieldRegex(field) {
  if (field === "start" || field === "end") return stateRegex;
  if (field === "read")      return readRegex;
  if (field === "write")     return writeRegex;
  if (field === "direction") return directionRegex;
  return null;
}

export default function TransitionTable({ nodes, edges, manualSymbols, setManualSymbols, onClose, onDeleteSymbol, onReplaceSymbol, onAddState, onEditRule, onDeleteNode, engine, isLocked = false }) {
  
  const [newSymbol, setNewSymbol] = useState("");
  const [newStateName, setNewStateName] = useState("");
  const [isWindowMode, setIsWindowMode] = useState(false);
  const [viewMode, setViewMode] = useState("matrix"); 

  const [position, setPosition] = useState({ x: 50, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const [size, setSize] = useState({ width: 600, height: 400 });
  const [isResizing, setIsResizing] = useState(false);
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });

  const [replacementChar, setReplacementChar] = useState("");
  const [cleanupTarget, setCleanupTarget] = useState(null);

  const [deleteNodeTarget, setDeleteNodeTarget] = useState(null); // { id, label }
  const [skipNodeDeleteConfirm, setSkipNodeDeleteConfirm] = useState(false);
  const [doNotAskAgainChecked, setDoNotAskAgainChecked] = useState(false);

  // Inline cell editing
  const [editingCell, setEditingCell] = useState(null); // { type, nodeId?, symbol?, ruleIdx?, field?, tuple? }
  const [editValue, setEditValue] = useState("");
  const [invalidCell, setInvalidCell] = useState(null); // tracks which cell has a format error
  const editInputRef = useRef(null);

  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  const committingRef = useRef(false);

  const startEdit = (cellKey, currentValue) => {
    if (isLocked) return;
    committingRef.current = false;
    setInvalidCell(null);
    setEditingCell(cellKey);
    setEditValue(currentValue);
  };

  const commitEdit = (cellKey, value) => {
    if (committingRef.current) return;

    const trimmed = (value !== undefined ? value : editValue).trim();
    if (!trimmed) { setEditingCell(null); setInvalidCell(null); return; }

    if (cellKey.type === "matrix") {
      // Normalise direction to uppercase before validation so l/r/n are accepted
      const normMatrix = trimmed.replace(/,\s*([lrn])\s*,/gi, (_, d) => `, ${d.toUpperCase()},`);
      const matrixValid = engine === "NonDeterministic" ? NTMRegex.test(normMatrix) : DTMRegex.test(normMatrix);
      if (!matrixValid) { setInvalidCell(cellKey); return; }
      setInvalidCell(null);
      committingRef.current = true;
      const ruleParts = normMatrix.split(/\s*\|\s*/);
      const rules = ruleParts.map(segment => {
        const parts = segment.split(",").map(s => s.trim());
        return { write: parts[0], direction: parts[1], nextStateLabel: parts.slice(2).join(",").trim() };
      });
      onEditRule({ type: "matrix", nodeId: cellKey.nodeId, symbol: cellKey.symbol, rules });

    } else if (cellKey.type === "matrix-mt") {
      // Normalise direction letters inside parens to uppercase
      const normMt = trimmed.replace(/,\s*([lrn])\s*([):])/gi, (_, d, after) => `, ${d.toUpperCase()}${after}`);
      if (!multiRegex.test(normMt)) { setInvalidCell(cellKey); return; }
      setInvalidCell(null);
      committingRef.current = true;
      onEditRule({ type: "matrix-mt", nodeId: cellKey.nodeId, tuple: cellKey.tuple, value: normMt });

    } else if (cellKey.type === "list") {
      const regex = getListFieldRegex(cellKey.field);
      // Normalise direction field to uppercase before testing
      const normValue = cellKey.field === "direction"
        ? trimmed.toUpperCase()
        : trimmed;
      if (regex && !regex.test(normValue)) { setInvalidCell(cellKey); return; }
      setInvalidCell(null);
      committingRef.current = true;
      onEditRule({ type: "list", ruleIdx: cellKey.ruleIdx, field: cellKey.field, value: normValue, allRules: multiTapeRules });
    }

    setEditingCell(null);
  };

  const cancelEdit = () => {
    committingRef.current = true;
    setInvalidCell(null);
    setEditingCell(null);
  };

  const isCellEditing = (key) => {
    if (!editingCell) return false;
    return JSON.stringify(editingCell) === JSON.stringify(key);
  };

  const isCellInvalid = (key) => {
    if (!invalidCell) return false;
    return JSON.stringify(invalidCell) === JSON.stringify(key);
  };

  const handleMouseDown = (e) => {
    if (isWindowMode) {
      setIsDragging(true);
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y
      };
    }
  };

  const handleResizeMouseDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    };
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        const HEADER_H = 42;
        const rawX = e.clientX - dragOffset.current.x;
        const rawY = e.clientY - dragOffset.current.y;
        setPosition({
          x: Math.min(Math.max(rawX, -(size.width  - 120)), window.innerWidth  - 120),
          y: Math.min(Math.max(rawY,  0),                   window.innerHeight - HEADER_H),
        });
      }

      if (isResizing) {
        const deltaX = e.clientX - resizeStart.current.x;
        const deltaY = e.clientY - resizeStart.current.y;
        setSize({
          width: Math.max(320, resizeStart.current.width + deltaX),
          height: Math.max(200, resizeStart.current.height + deltaY)
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isResizing, size]);

  // --- DATA PROCESSING ---
  const { 
    symbols, matrix, sortedNodes, derivedSymbols, 
    isMultiTape, multiTapeRules, multiTapeColumns, multiTapeMatrix 
  } = useMemo(() => {
    const derivedSet = new Set();
    const nodeMap = {}; 
    nodes.forEach((node) => { nodeMap[node.id] = node; });

    const detectedMultiTape = edges.some(edge => 
      edge.data?.labels?.some(l => 
        Object.keys(l).some(k => k.startsWith('tape'))
      )
    );

    const sortedNodes = [...nodes].sort((a, b) => {
      if (a.type === 'start') return -1;
      if (b.type === 'start') return 1;
      const labelA = getNodeLabel(a);
      const labelB = getNodeLabel(b);
      return labelA.localeCompare(labelB, undefined, { numeric: true });
    });

    if (detectedMultiTape) {
      const rules = [];
      let maxTapes = 2;
      edges.forEach(e => e.data?.labels?.forEach(l => {
        Object.keys(l).forEach(k => {
          if(k.startsWith('tape')) {
            const num = parseInt(k.replace('tape',''), 10);
            if(!isNaN(num)) maxTapes = Math.max(maxTapes, num);
          }
        });
      }));

      edges.forEach(edge => {
        const sourceNode = nodeMap[edge.source];
        if(!sourceNode) return;
        const sourceLabel = getNodeLabel(sourceNode);
        const targetLabel = nodeMap[edge.target] ? getNodeLabel(nodeMap[edge.target]) : "?";

        edge.data?.labels?.forEach(label => {
          const reads = [];
          const writes = [];
          const dirs = [];

          for(let i=1; i<=maxTapes; i++) {
            const tData = label[`tape${i}`] || { read: "␣", write: "␣", direction: 'N' };
            reads.push(tData.read);
            writes.push(tData.write);
            dirs.push(tData.direction);

            if (tData.read && tData.read !== "␣" && tData.read !== '') derivedSet.add(tData.read);
            if (tData.write && tData.write !== "␣" && tData.write !== '') derivedSet.add(tData.write);
          }

          rules.push({
            start: sourceLabel,
            startId: edge.source,
            read: reads.join(" : "), 
            write: writes.join(", "),
            direction: dirs.join(", "),
            end: targetLabel,
            rawWrites: writes,
            rawDirs: dirs,
            sortKey: `${sourceLabel}-${reads.join(' : ')}`
          });
        });
      });

      rules.sort((a, b) => a.sortKey.localeCompare(b.sortKey, undefined, { numeric: true }));

      const uniqueReadTuples = Array.from(new Set(rules.map(r => r.read))).sort();
      const mtMatrix = {};
      rules.forEach(r => {
        if(!mtMatrix[r.startId]) mtMatrix[r.startId] = {};
        
        const cellContent = `(${r.rawWrites.map((w, i) => `${w},${r.rawDirs[i]}`).join(" : ")}) -> ${r.end}`;
        if (mtMatrix[r.startId][r.read]) {
            mtMatrix[r.startId][r.read] += ` | ${cellContent}`;
        } else {
            mtMatrix[r.startId][r.read] = cellContent;
        }
      });

      const combinedSet = new Set([...derivedSet, ...manualSymbols]);
      const sortedSymbols = Array.from(combinedSet).sort();

      return { 
        symbols: sortedSymbols, matrix: {}, sortedNodes, derivedSymbols: derivedSet, 
        isMultiTape: true, multiTapeRules: rules, multiTapeColumns: uniqueReadTuples, multiTapeMatrix: mtMatrix
      };

    } else {
      const matrix = {};
      sortedNodes.forEach(n => (matrix[n.id] = {}));

      edges.forEach((edge) => {
        const sourceId = edge.source;
        const targetLabel = nodeMap[edge.target] ? getNodeLabel(nodeMap[edge.target]) : "?";
        const rules = edge.data?.labels || [];

        rules.forEach((rule) => {
          if (rule.read === undefined) return;
          derivedSet.add(rule.read);
          if (rule.write) derivedSet.add(rule.write);
          
          const cellContent = `${rule.write}, ${rule.direction}, ${targetLabel}`;
          if (!matrix[sourceId]) matrix[sourceId] = {};
          
          if (matrix[sourceId][rule.read]) {
            matrix[sourceId][rule.read] += ` | ${cellContent}`;
          } else {
            matrix[sourceId][rule.read] = cellContent;
          }
        });
      });

      const combinedSet = new Set([...derivedSet, ...manualSymbols]);
      const sortedSymbols = Array.from(combinedSet).sort();

      return { 
        symbols: sortedSymbols, matrix, sortedNodes, derivedSymbols: derivedSet, 
        isMultiTape: false, multiTapeRules: [], multiTapeColumns: [], multiTapeMatrix: {}
      };
    }
  }, [nodes, edges, manualSymbols]);

  // Allow only 1 character; space becomes ␣
  const clampOne = (value) => {
    const raw = value.length > 1 ? value[value.length - 1] : value;
    return raw === " " ? "␣" : raw;
  };

  const handleAddSymbol = (e) => {
    e.preventDefault();
    const trimmed = newSymbol.trim();
    if (!trimmed) return;
    const clamped = clampOne(trimmed);
    if (!manualSymbols.includes(clamped)) setManualSymbols(prev => [...prev, clamped]);
    setNewSymbol("");
  };

  const handleDeleteSymbol = (symbol) => {
    if (derivedSymbols.has(symbol)) {
      setCleanupTarget(symbol); 
    } else {
      setManualSymbols(prev => prev.filter(s => s !== symbol));
    }
  };

  const handleAddState = (e) => {
    e.preventDefault();
    const trimmed = newStateName.trim();
    if (!trimmed) return;
    const exists = nodes.some(n => getNodeLabel(n) === trimmed);
    if (exists) { setNewStateName(""); return; }
    onAddState(trimmed);
    setNewStateName("");
  };

  const handleDeleteNodeClick = (node) => {
    if (skipNodeDeleteConfirm) {
      onDeleteNode(node.id);
    } else {
      setDoNotAskAgainChecked(false);
      setDeleteNodeTarget({ id: node.id, label: getNodeLabel(node) });
    }
  };

  const confirmDeleteNode = () => {
    if (doNotAskAgainChecked) setSkipNodeDeleteConfirm(true);
    onDeleteNode(deleteNodeTarget.id);
    setDeleteNodeTarget(null);
  };

  const executeCleanup = (action) => {
    if (action === 'delete') {
      onDeleteSymbol(cleanupTarget);
    } else if (action === 'replace') {
      onReplaceSymbol(cleanupTarget, replacementChar); 
    }
    setCleanupTarget(null);
    setReplacementChar("");
  };

  const containerClass = isWindowMode ? "popup-menu table-popup modeless-window" : "popup-menu table-popup";

  const windowStyle = isWindowMode 
    ? { left: `${position.x}px`, top: `${position.y}px`, width: `${size.width}px`, height: `${size.height}px`, margin: 0, position: 'fixed' } 
    : {};

  return (
    <div className={isWindowMode ? "" : "popup-overlay"} onClick={!isWindowMode ? onClose : undefined}>
      <div className={containerClass} style={windowStyle} onClick={(e) => e.stopPropagation()}>
        <div className="popup-header" style={{ cursor: isWindowMode ? "grab" : "default" }} onMouseDown={handleMouseDown}>
            <h3>Transition Table</h3>
            <div className="header-actions">
              {isMultiTape && (
                <button className="window-toggle-btn" onClick={() => setViewMode(viewMode === "list" ? "matrix" : "list")} onMouseDown={(e) => e.stopPropagation()}>
                  {viewMode === "list" ? "Matrix View" : "List View"}
                </button>
              )}
              <button className="window-toggle-btn" onClick={() => setIsWindowMode(!isWindowMode)} onMouseDown={(e) => e.stopPropagation()}>
                {isWindowMode ? "Modal View" : "Float Window"}
              </button>
              <button className="close-btn" onClick={onClose} onMouseDown={(e) => e.stopPropagation()}>×</button>
            </div>
        </div>

        {isLocked && (
          <div style={{ background: '#fff3cd', color: '#856404', fontSize: '0.8rem', padding: '5px 12px', borderBottom: '1px solid #ffc107', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Table is read-only while the simulation is running.
          </div>
        )}

        {isMultiTape ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
              <div className="multitape-alphabet-display" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: '6px',width: '95%'}}>
                  <div className="sigma-box" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>Alphabet (Σ) :</div>
                  {symbols.map((symbol) => (
                    <span key={symbol} className={`symbol-tag ${derivedSymbols.has(symbol) ? 'derived' : 'manual'}`}>
                      {symbol}
                      <button className="remove-symbol-btn" onClick={() => handleDeleteSymbol(symbol)} disabled={isLocked}>×</button>
                    </span>
                  ))}
                  <form onSubmit={handleAddSymbol} style={{ display: 'inline-flex', margin: 0 }}>
                    <input type="text" value={newSymbol} onChange={(e) => setNewSymbol(clampOne(e.target.value))} placeholder="+" maxLength={1} className="symbol-input-inline" title="Type and press Enter to add symbol" disabled={isLocked} />
                  </form>
              </div>
              <form className="alphabet-controls"  onSubmit={handleAddState}>
                <label>New State (Q): </label>
                <input
                  type="text"
                  value={newStateName}
                  onChange={(e) => setNewStateName(e.target.value)}
                  placeholder="e.g. S2"
                  className="symbol-input"
                  style={{ width: '90px' }}
                  disabled={isLocked}
                />
                <button type="submit" disabled={!newStateName.trim() || isLocked}>Add</button>
              </form>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '15px', marginBottom: '15px', flexWrap: 'wrap' }}>
            <form className="alphabet-controls" onSubmit={handleAddSymbol} style={{ margin: 0 }}>
              <label>New Alphabet (Σ): </label>
              <input type="text" value={newSymbol} onChange={(e) => setNewSymbol(clampOne(e.target.value))} placeholder="Add char..." maxLength={1} className="symbol-input" disabled={isLocked} />
              <button type="submit" disabled={!newSymbol.trim() || isLocked}>Add</button>
            </form>
            <form className="alphabet-controls" onSubmit={handleAddState} style={{ margin: 0 }}>
              <label>New State (Q): </label>
              <input
                type="text"
                value={newStateName}
                onChange={(e) => setNewStateName(e.target.value)}
                placeholder="e.g. S2"
                className="symbol-input"
                style={{ width: '90px' }}
                disabled={isLocked}
              />
              <button type="submit" disabled={!newStateName.trim() || isLocked}>Add</button>
            </form>
          </div>
        )}
              
        <div className="table-wrapper">
          <table className="transition-table">
            {isMultiTape ? (
              viewMode === "list" ? (
                <>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', borderRight: 'none' }}>Start State</th>
                      <th style={{ textAlign: 'center' }}>Read</th>
                      <th style={{ textAlign: 'center' }}>Write</th>
                      <th style={{ textAlign: 'center' }}>Direction</th>
                      <th style={{ textAlign: 'center' }}>Next State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {multiTapeRules.map((rule, idx) => {
                      const ruleNode = nodes.find(n => n.id === rule.startId);
                      return (
                      <tr key={idx}>
                        {["start", "read", "write", "direction", "end"].map((field, fi) => {
                          const cellKey = { type: "list", ruleIdx: idx, field };
                          const editing = isCellEditing(cellKey);
                          const value = field === "start" ? rule.start : field === "read" ? rule.read : field === "write" ? rule.write : field === "direction" ? rule.direction : rule.end;
                          const style = fi === 0 ? { textAlign: 'left', fontWeight: 'bold', whiteSpace: 'nowrap' } : fi === 4 ? { fontStyle: 'italic' } : {};
                          return (
                            <td key={field} style={style}>
                              {fi === 0 ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  {ruleNode && <button className="delete-node-btn" onClick={() => handleDeleteNodeClick(ruleNode)} title="Delete state" disabled={isLocked}>×</button>}
                                  {value}
                                </span>
                              ) : editing ? (
                                <div className="rule-cell-input-wrapper">
                                  {isCellInvalid(cellKey) && (
                                    <div className="rule-cell-error-bubble">
                                      ⚠ Invalid format
                                      <div className="rule-cell-error-bubble-tail" />
                                    </div>
                                  )}
                                  <input
                                    ref={editInputRef}
                                    className={`rule-cell-input${isCellInvalid(cellKey) ? " error" : ""}`}
                                    value={editValue}
                                    onChange={e => { setEditValue(e.target.value); setInvalidCell(null); }}
                                    onBlur={() => commitEdit(cellKey, editValue)}
                                    onKeyDown={e => {
                                      if (e.key === "Enter") { e.preventDefault(); commitEdit(cellKey, editValue); }
                                      if (e.key === "Escape") cancelEdit();
                                    }}
                                    style={{ minWidth: "120px", width: `${Math.max(editValue.length + 2, 10)}ch` }}
                                  />
                                </div>
                              ) : (
                                <span
                                  className="rule-cell rule-cell--editable"
                                  title="Double-click to edit"
                                  onDoubleClick={() => startEdit(cellKey, value)}
                                >{value}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                      );
                    })}
                  </tbody>
                </>
              ) : (
                <>
                  <thead>
                    <tr>
                      <th className="diagonal-cell"><span className="diagonal-top">Read</span><span className="diagonal-bottom">Q</span></th>
                      {multiTapeColumns.map((tuple) => (
                        <th key={tuple} className="symbol-header">
                          {tuple}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedNodes.map((node) => (
                      <tr key={node.id}>
                        <td className="row-header">
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <button className="delete-node-btn" onClick={() => handleDeleteNodeClick(node)} title="Delete state" disabled={isLocked}>×</button>
                            {getNodeLabel(node)}
                          </span>
                        </td>
                        {multiTapeColumns.map((tuple) => {
                          const content = multiTapeMatrix[node.id]?.[tuple];
                          const cellKey = { type: "matrix-mt", nodeId: node.id, tuple };
                          const editing = isCellEditing(cellKey);
                          return (
                            <td key={`${node.id}-${tuple}`}>
                              {editing ? (
                                <div className="rule-cell-input-wrapper">
                                  {isCellInvalid(cellKey) && (
                                    <div className="rule-cell-error-bubble">
                                      ⚠ Invalid format
                                      <div className="rule-cell-error-bubble-tail" />
                                    </div>
                                  )}
                                  <input
                                    ref={editInputRef}
                                    className={`rule-cell-input${isCellInvalid(cellKey) ? " error" : ""}`}
                                    value={editValue}
                                    onChange={e => { setEditValue(e.target.value); setInvalidCell(null); }}
                                    onBlur={() => commitEdit(cellKey, editValue)}
                                    onKeyDown={e => {
                                      if (e.key === "Enter") { e.preventDefault(); commitEdit(cellKey, editValue); }
                                      if (e.key === "Escape") cancelEdit();
                                    }}
                                    style={{ minWidth: "120px", width: `${Math.max(editValue.length + 2, 10)}ch` }}
                                  />
                                </div>
                              ) : content ? (
                                <span className="rule-cell rule-cell--editable" style={{ fontSize: '0.85rem' }} title="Double-click to edit" onDoubleClick={() => startEdit(cellKey, content)}>{content}</span>
                              ) : (
                                <span className="empty-cell rule-cell--editable" title="Double-click to add rule" onDoubleClick={() => startEdit(cellKey, "")}>/</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </>
              )
            ) : (
              <>
                <thead>
                  <tr>
                    <th className="diagonal-cell"><span className="diagonal-top">Σ</span><span className="diagonal-bottom">Q</span></th>
                    {symbols.map((symbol) => (
                      <th key={symbol} className="symbol-header" style={{ position: 'relative' }}>
                        <span style={{ color: derivedSymbols.has(symbol) ? '#1565c0' : '#a21f1f' }}>
                            {symbol}
                        </span>
                        <button className="delete-symbol-btn" onClick={() => handleDeleteSymbol(symbol)} disabled={isLocked}>×</button>
                      </th>
                  ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedNodes.map((node) => (
                    <tr key={node.id}>
                      <td className="row-header">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <button className="delete-node-btn" onClick={() => handleDeleteNodeClick(node)} disabled={isLocked}>×</button>
                          {getNodeLabel(node)}
                        </span>
                      </td>
                      {symbols.map((symbol) => {
                        const content = matrix[node.id]?.[symbol];
                        const cellKey = { type: "matrix", nodeId: node.id, symbol };
                        const editing = isCellEditing(cellKey);
                        return (
                          <td key={`${node.id}-${symbol}`}>
                            {editing ? (
                              <div className="rule-cell-input-wrapper">
                                {isCellInvalid(cellKey) && (
                                  <div className="rule-cell-error-bubble">
                                    ⚠ Invalid format
                                    <div className="rule-cell-error-bubble-tail" />
                                  </div>
                                )}
                                <input
                                  ref={editInputRef}
                                  className={`rule-cell-input${isCellInvalid(cellKey) ? " error" : ""}`}
                                  value={editValue}
                                  onChange={e => { setEditValue(e.target.value); setInvalidCell(null); }}
                                  onBlur={() => commitEdit(cellKey, editValue)}
                                  onKeyDown={e => {
                                    if (e.key === "Enter") { e.preventDefault(); commitEdit(cellKey, editValue); }
                                    if (e.key === "Escape") cancelEdit();
                                  }}
                                  style={{ minWidth: "120px", width: `${Math.max(editValue.length + 2, 10)}ch` }}
                                />
                              </div>
                            ) : content ? (
                              <span
                                className="rule-cell rule-cell--editable"
                                title="Double-click to edit"
                                onDoubleClick={() => startEdit(cellKey, content)}
                              >{content}</span>
                            ) : (
                              <span
                                className="empty-cell rule-cell--editable"
                                title="Double-click to add rule"
                                onDoubleClick={() => startEdit(cellKey, "")}
                              >/</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </>
            )}
          </table>
        </div>
        {isWindowMode && <div className="resize-handle" onMouseDown={handleResizeMouseDown} />}
      </div>
      {cleanupTarget && (
        <div className="popup-overlay" style={{ zIndex: 3000 }} onClick={(e) => e.stopPropagation()}>
          <div className="popup-menu" style={{ maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h3>Manage Symbol: "{cleanupTarget}"</h3>
            <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '20px', textAlign: 'center' }}>
              This symbol is used in the diagram. Deleting it will remove all rules that read this character.
            </p>
            
            <div className="form-group">
              <label>Replace with another character?</label>
              <input 
                type="text" 
                maxLength={1} 
                value={replacementChar}
                onChange={(e) => setReplacementChar(e.target.value)}
                placeholder="New char..." 
                className="symbol-input"
                style={{ width: '80%', margin: '0 auto' }}
              />
            </div>

            <div className="popup-actions" style={{ flexDirection: 'column', gap: '10px' }}>
              <button 
                className="add-label-button" 
                style={{ backgroundColor: '#d1e7dd', width: '100%', color: '#0f5132' }}
                onClick={() => executeCleanup('replace')}
                disabled={!replacementChar.trim()}
              >
                Replace Everywhere
              </button>
              <button 
                className="remove-button" 
                style={{ width: '100%', margin: 0 }}
                onClick={() => executeCleanup('delete')}
              >
                Delete All Rules with "{cleanupTarget}"
              </button>
              <button 
                className="window-toggle-btn" 
                style={{ width: '100%' }}
                onClick={() => {
                   setCleanupTarget(null);
                   setReplacementChar("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteNodeTarget && (
        <div className="popup-overlay" style={{ zIndex: 3000 }} onClick={(e) => e.stopPropagation()}>
          <div className="popup-menu" style={{ maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h3>Delete State "{deleteNodeTarget.label}"?</h3>
            <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '20px', textAlign: 'center' }}>
              This will delete the state and all connecting edges.
            </p>
            <div className="popup-actions" style={{ flexDirection: 'column', gap: '10px' }}>
              <button
                className="remove-button"
                style={{ width: '100%', margin: 0 }}
                onClick={confirmDeleteNode}
              >
                Yes, Delete
              </button>
              <button
                className="window-toggle-btn"
                style={{ width: '100%' }}
                onClick={() => setDeleteNodeTarget(null)}
              >
                No, Cancel
              </button>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px', fontSize: '0.82rem', color: '#888', cursor: 'pointer', justifyContent: 'center' }}>
              <input
                type="checkbox"
                checked={doNotAskAgainChecked}
                onChange={(e) => setDoNotAskAgainChecked(e.target.checked)}
              />
              Do not ask again
            </label>
          </div>
        </div>
      )}
    </div>
  );
}