/* src/Visualiser.jsx */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ReactFlowProvider, useNodesState, useEdgesState } from 'reactflow';

import TapeContainer from './simulatorComponents/TapeContainer';
import DiagramContainer from './visualComponents/DiagramContainer';
import TransitionTable from './simulatorComponents/TransitionTable';
import './Visualiser.css';

// Original Examples
import palindromeData from './examples/palindrome.json'; // Fixed capitalization
import binaryIncrementData from './examples/binary_increment.json';
import busyBeaverData from './examples/busy_beaver.json';

// New Multi-Tape Examples
import palindromeMultiData from './examples/palindrome_multi.json';
import isEqualData from './examples/is_equal.json';
import binaryAdditionData from './examples/binary_addition.json';

const exampleMap = {
  // Deterministic
  palindrome: palindromeData,
  binary_increment: binaryIncrementData,
  busy_beaver: busyBeaverData,
  
  // Multi-Tape
  palindromeMulti: palindromeMultiData,
  isequal: isEqualData, // Fixed key to match App.jsx value "isequal"
  binary_addition: binaryAdditionData
};

export default function Visualiser({ engine, selectedExample, showTable, setShowTable }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [activeNodeId, setActiveNodeId] = useState(null);
  const [activeEdgeId, setActiveEdgeId] = useState(null);
  const [currentSymbol, setCurrentSymbol] = useState("");
  const [stepCount, setStepCount] = useState(0);

  const [loadedInput, setLoadedInput] = useState("");
  const [manualSymbols, setManualSymbols] = useState([]);

  // NEW: Clear workspace/tape when engine changes
  useEffect(() => {
    setNodes([]);
    setEdges([]);
    setLoadedInput(""); // This will trigger the TapeContainer to reset its internal state
    setManualSymbols([]);
    setStepCount(0);
    setCurrentSymbol("");
    setActiveNodeId(null);
    setActiveEdgeId(null);
  }, [engine, setNodes, setEdges]);

  useEffect(() => {
    if (selectedExample && exampleMap[selectedExample]) {
      const { nodes: newNodes, edges: newEdges, defaultInput } = exampleMap[selectedExample];
      setNodes(newNodes);
      setEdges(newEdges);
      setLoadedInput(defaultInput || "");
      setActiveNodeId(null);
      setActiveEdgeId(null);
      setStepCount(0);
      setCurrentSymbol("");
      setManualSymbols([]); 
    }
  }, [selectedExample, setNodes, setEdges]);

  // NEW: Handle full clear (resets loadedInput to prevent ghost inputs)
  const handleClear = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setLoadedInput("");
    setManualSymbols([]);
    setStepCount(0);
    setCurrentSymbol("");
    setActiveNodeId(null);
    setActiveEdgeId(null);
  }, [setNodes, setEdges]);

  // 1. Calculate Valid Alphabet (Read AND Write symbols + Manual)
  const validAlphabet = useMemo(() => {
    const derived = new Set();
    edges.forEach(edge => {
        edge.data?.labels?.forEach(l => {
            // Handle Single Tape
            if (l.read !== undefined && l.read !== "") derived.add(l.read);
            if (l.write !== undefined && l.write !== "") derived.add(l.write);
            
            // Handle Multi Tape (dynamic keys)
            Object.keys(l).forEach(key => {
                if (key.startsWith('tape')) {
                    const t = l[key];
                    if (t.read) derived.add(t.read);
                    if (t.write) derived.add(t.write);
                }
            });
        });
    });
    return new Set([...derived, ...manualSymbols]);
  }, [edges, manualSymbols]);

  return (
    <ReactFlowProvider>
      <div className="visualiser">
        
        {showTable && (
          <TransitionTable 
            nodes={nodes} 
            edges={edges} 
            manualSymbols={manualSymbols}       
            setManualSymbols={setManualSymbols}
            onClose={() => setShowTable(false)} 
          />
        )}

        <div className="tape-container-wrapper">
          <TapeContainer 
            nodes={nodes}
            edges={edges}
            activeNodeId={activeNodeId}
            setActiveNodeId={setActiveNodeId}
            setActiveEdgeId={setActiveEdgeId}
            setCurrentSymbol={setCurrentSymbol}
            setStepCount={setStepCount} 
            loadedInput={loadedInput}
            validAlphabet={validAlphabet}
            engine={engine}
          />
        </div>

        <div className="diagram-container-wrapper">
          <DiagramContainer 
            key={selectedExample} 
            nodes={nodes} 
            edges={edges} 
            onNodesChange={onNodesChange} 
            onEdgesChange={onEdgesChange}
            setNodes={setNodes}
            setEdges={setEdges}
            activeNodeId={activeNodeId}
            activeEdgeId={activeEdgeId}
            currentSymbol={currentSymbol}
            stepCount={stepCount}
            engine={engine} 
            onClear={handleClear}
          />
        </div>

      </div>
    </ReactFlowProvider>
  );
}