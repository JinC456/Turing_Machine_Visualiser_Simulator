/* src/simulatorComponents/TransitionTable.jsx */
import React, { useMemo, useState, useRef, useEffect } from "react";
import "../Visualiser.css";
import { getNodeLabel } from "./engines/Deterministic";

export default function TransitionTable({ nodes, edges, manualSymbols, setManualSymbols, onClose, onDeleteSymbol, onReplaceSymbol }) {
  
  const [newSymbol, setNewSymbol] = useState("");
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
        const HEADER_H = 42; // minimum visible strip to grab (px)
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
            read: reads.join(","), 
            write: writes.join(", "),
            direction: dirs.join(", "),
            end: targetLabel,
            rawWrites: writes,
            rawDirs: dirs,
            sortKey: `${sourceLabel}-${reads.join(',')}`
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

  const handleAddSymbol = (e) => {
    e.preventDefault();
    const trimmed = newSymbol.trim();
    if (!trimmed) return;
    if (!manualSymbols.includes(trimmed)) setManualSymbols(prev => [...prev, trimmed]);
    setNewSymbol("");
  };

  const handleDeleteSymbol = (symbol) => {
    if (derivedSymbols.has(symbol)) {
      setCleanupTarget(symbol); 
    } else {
      setManualSymbols(prev => prev.filter(s => s !== symbol));
    }
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

        {isMultiTape ? (
          <div className="multitape-alphabet-display">
              <div className="sigma-box">Σ :</div>
              <div className="symbol-list">
                {symbols.map((symbol) => (
                  <span key={symbol} className={`symbol-tag ${derivedSymbols.has(symbol) ? 'derived' : 'manual'}`}>
                    {symbol}
                    {/* Using remove-symbol-btn class to fix missing X on pills */}
                    <button className="remove-symbol-btn" onClick={() => handleDeleteSymbol(symbol)}>×</button>
                  </span>
                ))}
                <form onSubmit={handleAddSymbol} style={{ display: 'inline-flex' }}>
                  <input type="text" value={newSymbol} onChange={(e) => setNewSymbol(e.target.value)} placeholder="+" maxLength={1} className="symbol-input-inline" title="Type and press Enter to add symbol" />
                </form>
              </div>
          </div>
        ) : (
          <form className="alphabet-controls" onSubmit={handleAddSymbol}>
            <label>Alphabet (Σ): </label>
            <input type="text" value={newSymbol} onChange={(e) => setNewSymbol(e.target.value)} placeholder="Add char..." maxLength={1} className="symbol-input" />
            <button type="submit" disabled={!newSymbol.trim()}>Add</button>
          </form>
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
                    {multiTapeRules.map((rule, idx) => (
                      <tr key={idx}>
                        <td style={{ textAlign: 'left', fontWeight: 'bold' }}>{rule.start}</td>
                        <td>{rule.read.replace(/,/g, ", ")}</td>
                        <td>{rule.write}</td>
                        <td>{rule.direction}</td>
                        <td style={{ fontStyle: 'italic' }}>{rule.end}</td>
                      </tr>
                    ))}
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
                            {/* No X in headers for Multi-tape per previous request */}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedNodes.map((node) => (
                        <tr key={node.id}>
                          <td className="row-header">{getNodeLabel(node)}</td>
                          {multiTapeColumns.map((tuple) => {
                            const content = multiTapeMatrix[node.id]?.[tuple];
                            return (
                              <td key={`${node.id}-${tuple}`}>
                                {content ? <span className="rule-cell" style={{ fontSize: '0.85rem' }}>{content}</span> : <span className="empty-cell">/</span>}
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
                        {/* Colored text for DTM/NTM headers: Blue for derived, Red for manual */}
                        <span style={{ color: derivedSymbols.has(symbol) ? '#1565c0' : '#a21f1f' }}>
                            {symbol}
                        </span>
                        <button className="delete-symbol-btn" onClick={() => handleDeleteSymbol(symbol)}>×</button>
                      </th>
                  ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedNodes.map((node) => (
                    <tr key={node.id}>
                      <td className="row-header">{getNodeLabel(node)}</td>
                      {symbols.map((symbol) => {
                        const content = matrix[node.id]?.[symbol];
                        return (
                          <td key={`${node.id}-${symbol}`}>
                            {content ? <span className="rule-cell">{content}</span> : <span className="empty-cell">/</span>}
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
    </div>
  );
}