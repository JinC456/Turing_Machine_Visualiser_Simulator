/* src/Visualiser.jsx */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ReactFlowProvider, useNodesState, useEdgesState } from 'reactflow';

import TapeContainer from './simulatorComponents/TapeContainer';
import DiagramContainer from './visualComponents/DiagramContainer';
import TransitionTable from './simulatorComponents/TransitionTable';
import './Visualiser.css';

// Original Examples
import palindromeData from './examples/palindrome.json'; 
import binaryIncrementData from './examples/binary_increment.json';
import busyBeaverData from './examples/busy_beaver.json';

// New Multi-Tape Examples
import palindromeMultiData from './examples/palindrome_multi.json';
import isEqualMultiData from './examples/is_equal_multi.json';
import binaryAdditionData from './examples/binary_addition.json';

// New NTM Examples
import isEqualNTMData from './examples/Is_equal_NTM.json';
import FindHashData from './examples/Find_hash.json';

const exampleMap = {
  // Deterministic
  palindrome: palindromeData,
  binary_increment: binaryIncrementData,
  busy_beaver: busyBeaverData,
  
  // Multi-Tape
  palindromeMulti: palindromeMultiData,
  is_equal_multi: isEqualMultiData, 
  binary_addition: binaryAdditionData,

  // Non-Deterministic
  is_equal_NTM: isEqualNTMData, 
  Find_hash: FindHashData
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

  // --- LIFTED STATE: Simulation Running Status ---
  const [isRunning, setIsRunning] = useState(false);

  // Clear workspace/tape when engine changes
  useEffect(() => {
    setNodes([]);
    setEdges([]);
    setLoadedInput(""); 
    setManualSymbols([]);
    setStepCount(0);
    setCurrentSymbol("");
    setActiveNodeId(null);
    setActiveEdgeId(null);
    setIsRunning(false); // Ensure simulation stops on engine switch
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
      setIsRunning(false); // Ensure simulation stops on example load
    }
  }, [selectedExample, setNodes, setEdges]);

  const handleClear = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setLoadedInput("");
    setManualSymbols([]);
    setStepCount(0);
    setCurrentSymbol("");
    setActiveNodeId(null);
    setActiveEdgeId(null);
    setIsRunning(false);
  }, [setNodes, setEdges]);

  // Calculate Valid Alphabet
  const validAlphabet = useMemo(() => {
    const derived = new Set();
    edges.forEach(edge => {
        edge.data?.labels?.forEach(l => {
            if (l.read !== undefined && l.read !== "") derived.add(l.read);
            if (l.write !== undefined && l.write !== "") derived.add(l.write);
            
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
            setNodes={setNodes}
            activeNodeId={activeNodeId}
            setActiveNodeId={setActiveNodeId}
            setActiveEdgeId={setActiveEdgeId}
            setCurrentSymbol={setCurrentSymbol}
            setStepCount={setStepCount} 
            loadedInput={loadedInput}
            validAlphabet={validAlphabet}
            engine={engine}
            isRunning={isRunning}
            setIsRunning={setIsRunning}
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
            // Pass lock status
            isLocked={isRunning}
          />
        </div>

      </div>
    </ReactFlowProvider>
  );
}