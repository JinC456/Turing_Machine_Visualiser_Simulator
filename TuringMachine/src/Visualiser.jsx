/* src/Visualiser.jsx */
import React, { useState, useEffect, useMemo } from 'react';
import { ReactFlowProvider, useNodesState, useEdgesState } from 'reactflow';

import TapeContainer from './simulatorComponents/TapeContainer';
import DiagramContainer from './visualComponents/DiagramContainer';
import TransitionTable from './simulatorComponents/TransitionTable';
import './Visualiser.css';

import palindromeData from './examples/Palindrome.json';
import binaryIncrementData from './examples/binary_increment.json';
import busyBeaverData from './examples/busy_beaver.json';

const exampleMap = {
  palindrome: palindromeData,
  binary_increment: binaryIncrementData,
  busy_beaver: busyBeaverData
};

export default function Visualiser({ selectedExample, showTable, setShowTable }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [activeNodeId, setActiveNodeId] = useState(null);
  const [activeEdgeId, setActiveEdgeId] = useState(null);
  const [currentSymbol, setCurrentSymbol] = useState("");
  const [stepCount, setStepCount] = useState(0);

  const [loadedInput, setLoadedInput] = useState("");
  const [manualSymbols, setManualSymbols] = useState([]);

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

  // 1. Calculate Valid Alphabet (Read AND Write symbols + Manual)
  const validAlphabet = useMemo(() => {
    const derived = new Set();
    edges.forEach(edge => {
        edge.data?.labels?.forEach(l => {
            if (l.read !== undefined && l.read !== "") derived.add(l.read);
            // FIX: Include written symbols in the alphabet
            if (l.write !== undefined && l.write !== "") derived.add(l.write);
        });
    });
    // Combine derived symbols with manually added symbols
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
          />
        </div>

      </div>
    </ReactFlowProvider>
  );
}