/* src/simulatorComponents/TransitionTable.jsx */
import React, { useMemo, useState } from "react";
import "../Visualiser.css";
import { getNodeLabel } from "./engines/Deterministic";

export default function TransitionTable({ nodes, edges, manualSymbols, setManualSymbols, onClose }) {
  
  const [newSymbol, setNewSymbol] = useState("");
  const [isWindowMode, setIsWindowMode] = useState(false);

  const { symbols, matrix, sortedNodes, derivedSymbols } = useMemo(() => {
    const derivedSet = new Set();
    const nodeMap = {}; 

    // Sort nodes using shared helper
    const sortedNodes = [...nodes].sort((a, b) => {
      if (a.type === 'start') return -1;
      if (b.type === 'start') return 1;
      const labelA = getNodeLabel(a);
      const labelB = getNodeLabel(b);
      return labelA.localeCompare(labelB, undefined, { numeric: true });
    });

    nodes.forEach((node) => { nodeMap[node.id] = node; });

    const matrix = {};
    sortedNodes.forEach(n => (matrix[n.id] = {}));

    edges.forEach((edge) => {
      const sourceId = edge.source;
      const targetId = edge.target;
      // Use shared helper
      const targetLabel = nodeMap[targetId] ? getNodeLabel(nodeMap[targetId]) : "?";
      const rules = edge.data?.labels || [];

      rules.forEach((rule) => {
        if (rule.read === undefined) return;
        
        derivedSet.add(rule.read);
        if (rule.write) derivedSet.add(rule.write);
        
        const cellContent = `${rule.write} ${rule.direction} ${targetLabel}`;
        
        if (!matrix[sourceId]) matrix[sourceId] = {};
        matrix[sourceId][rule.read] = cellContent;
      });
    });

    const combinedSet = new Set([...derivedSet, ...manualSymbols]);
    const sortedSymbols = Array.from(combinedSet).sort();

    return { 
      symbols: sortedSymbols, 
      matrix, 
      sortedNodes, 
      derivedSymbols: derivedSet 
    };
  }, [nodes, edges, manualSymbols]);

  const handleAddSymbol = (e) => {
    e.preventDefault();
    const trimmed = newSymbol.trim();
    if (!trimmed) return;
    
    if (!manualSymbols.includes(trimmed)) {
      setManualSymbols(prev => [...prev, trimmed]);
    }
    setNewSymbol("");
  };

  const handleDeleteSymbol = (symbol) => {
    if (!derivedSymbols.has(symbol)) {
      setManualSymbols(prev => prev.filter(s => s !== symbol));
    }
  };

  const containerClass = isWindowMode 
    ? "popup-menu table-popup modeless-window" 
    : "popup-menu table-popup";

  const tableContent = (
    <div className={containerClass} onClick={(e) => e.stopPropagation()}>
      <div className="popup-header">
          <h3>Transition Table</h3>
          
          <div className="header-actions">
            <button 
              className="window-toggle-btn" 
              onClick={() => setIsWindowMode(!isWindowMode)}
            >
              {isWindowMode ? "Modal View" : "In Window"}
            </button>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
      </div>

      <form className="alphabet-controls" onSubmit={handleAddSymbol}>
        <label>Alphabet (Σ): </label>
        <input 
          type="text" 
          value={newSymbol}
          onChange={(e) => setNewSymbol(e.target.value)}
          placeholder="Add char..."
          maxLength={1}
          className="symbol-input"
        />
        <button type="submit" disabled={!newSymbol.trim()}>Add</button>
      </form>
      
      <div className="table-wrapper">
        <table className="transition-table">
          <thead>
            <tr>
              <th className="diagonal-header"><i>Q</i> \ Σ</th>
              {symbols.map((symbol) => {
                const isUsed = derivedSymbols.has(symbol);
                return (
                  <th key={symbol} className="symbol-header">
                    {symbol}
                    {!isUsed && (
                      <button 
                        className="delete-symbol-btn"
                        onClick={() => handleDeleteSymbol(symbol)}
                      >
                        ×
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedNodes.map((node) => (
              <tr key={node.id}>
                {/* Use shared helper */}
                <td className="row-header">{getNodeLabel(node)}</td>
                {symbols.map((symbol) => {
                  const content = matrix[node.id]?.[symbol];
                  return (
                    <td key={`${node.id}-${symbol}`}>
                      {content ? (
                        <span className="rule-cell">{content}</span>
                      ) : (
                        <span className="empty-cell">/</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (isWindowMode) {
    return tableContent;
  }

  return (
    <div className="popup-overlay" onClick={onClose}>
      {tableContent}
    </div>
  );
}