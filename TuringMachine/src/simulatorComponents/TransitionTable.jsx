/* src/simulatorComponents/TransitionTable.jsx */
import React, { useMemo, useState, useRef, useEffect } from "react";
import "../Visualiser.css";
import { getNodeLabel } from "./engines/Deterministic";

export default function TransitionTable({ nodes, edges, manualSymbols, setManualSymbols, onClose }) {
  
  const [newSymbol, setNewSymbol] = useState("");
  const [isWindowMode, setIsWindowMode] = useState(false);
  const [viewMode, setViewMode] = useState("matrix"); 

  const [position, setPosition] = useState({ x: 50, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const [size, setSize] = useState({ width: 600, height: 400 });
  const [isResizing, setIsResizing] = useState(false);
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });


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
        setPosition({
          x: e.clientX - dragOffset.current.x,
          y: e.clientY - dragOffset.current.y
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
  }, [isDragging, isResizing]);

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
        const targetNode = nodeMap[edge.target];
        const sourceLabel = getNodeLabel(sourceNode);
        const targetLabel = getNodeLabel(targetNode);

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
        if(!mtMatrix[r.start]) mtMatrix[r.start] = {};
        
        // Handle Non-Determinism in Multi-Tape Matrix View
        const cellContent = `(${r.rawWrites.map((w, i) => `${w},${r.rawDirs[i]}`).join(" : ")}) -> ${r.end}`;
        if (mtMatrix[r.start][r.read]) {
            mtMatrix[r.start][r.read] += ` | ${cellContent}`;
        } else {
            mtMatrix[r.start][r.read] = cellContent;
        }
      });

      const combinedSet = new Set([...derivedSet, ...manualSymbols]);
      const sortedSymbols = Array.from(combinedSet).sort();

      return { 
        symbols: sortedSymbols, matrix: {}, sortedNodes, derivedSymbols: derivedSet, 
        isMultiTape: true, multiTapeRules: rules, multiTapeColumns: uniqueReadTuples, multiTapeMatrix: mtMatrix
      };

    } else {
      // --- SINGLE TAPE PROCESSING (Updated for NTM) ---
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
          
          // Append multiple choices together for NTM
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
    if (!derivedSymbols.has(symbol)) setManualSymbols(prev => prev.filter(s => s !== symbol));
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

        {!isMultiTape && (
          <form className="alphabet-controls" onSubmit={handleAddSymbol}>
            <label>Alphabet (Σ): </label>
            <input type="text" value={newSymbol} onChange={(e) => setNewSymbol(e.target.value)} placeholder="Add char..." maxLength={1} className="symbol-input" />
            <button type="submit" disabled={!newSymbol.trim()}>Add</button>
          </form>
        )}

        {isMultiTape && (
            <div className="multitape-alphabet-display">
                <div className="sigma-box">Σ :</div>
                <div className="symbol-list">
                  {symbols.map(s => (
                      <span key={s} className={`symbol-tag ${derivedSymbols.has(s) ? 'derived' : 'manual'}`}>
                          {s}
                          {!derivedSymbols.has(s) && (
                              <button className="remove-symbol-btn" onClick={() => handleDeleteSymbol(s)} title="Remove symbol">×</button>
                          )}
                      </span>
                  ))}
                  <form onSubmit={handleAddSymbol} style={{ display: 'inline-flex' }}>
                    <input type="text" value={newSymbol} onChange={(e) => setNewSymbol(e.target.value)} placeholder="+" maxLength={1} className="symbol-input-inline" title="Type and press Enter to add symbol" />
                  </form>
                </div>
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
                      <th className="diagonal-cell"><span className="diagonal-top">Σ</span><span className="diagonal-bottom">Q</span></th>
                      {multiTapeColumns.map((col, idx) => (
                        <th key={idx} className="symbol-header" style={{ minWidth: '80px' }}>{col.replace(/,/g, " : ")}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedNodes.map((node) => {
                      const label = getNodeLabel(node);
                      return (
                        <tr key={node.id}>
                          <td className="row-header">{label}</td>
                          {multiTapeColumns.map((col) => {
                            const content = multiTapeMatrix[label]?.[col];
                            return (
                              <td key={`${node.id}-${col}`}>
                                {content ? <span className="rule-cell" style={{ fontSize: '0.9rem' }}>{content}</span> : <span className="empty-cell">/</span>}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </>
              )
            ) : (
              <>
                <thead>
                  <tr>
                    <th className="diagonal-cell"><span className="diagonal-top">Σ</span><span className="diagonal-bottom">Q</span></th>
                    {symbols.map((symbol) => (
                        <th key={symbol} className="symbol-header">
                          {symbol}
                          {!derivedSymbols.has(symbol) && <button className="delete-symbol-btn" onClick={() => handleDeleteSymbol(symbol)}>×</button>}
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
    </div>
  );
}