import React, { useState, useEffect } from 'react';
import { ReactFlowProvider, useNodesState, useEdgesState } from 'reactflow';

import TapeContainer from './simulatorComponents/TapeContainer';
import DiagramContainer from './visualComponents/DiagramContainer';
import './Visualiser.css';

// 1. FIXED IMPORT: Matches "Palindrome.json" exactly (Capital P)
import palindromeData from './examples/Palindrome.json';
import binaryIncrementData from './examples/binary_increment.json';
import busyBeaverData from './examples/busy_beaver.json';

const exampleMap = {
  palindrome: palindromeData,
  binary_increment: binaryIncrementData,
  busy_beaver: busyBeaverData
};

export default function Visualiser({ selectedExample }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [activeNodeId, setActiveNodeId] = useState(null);
  const [activeEdgeId, setActiveEdgeId] = useState(null);
  const [currentSymbol, setCurrentSymbol] = useState("");
  const [stepCount, setStepCount] = useState(0);

  // NEW: State to hold the input string associated with the example
  const [loadedInput, setLoadedInput] = useState("");

  useEffect(() => {
    // 2. Load data when selectedExample changes
    if (selectedExample && exampleMap[selectedExample]) {
      const { nodes: newNodes, edges: newEdges, defaultInput } = exampleMap[selectedExample];
      setNodes(newNodes);
      setEdges(newEdges);
      
      // Set the input for the TapeContainer
      setLoadedInput(defaultInput || "");

      // Reset simulation state
      setActiveNodeId(null);
      setActiveEdgeId(null);
      setStepCount(0);
      setCurrentSymbol("");
    }
  }, [selectedExample, setNodes, setEdges]);

  return (
    <ReactFlowProvider>
      <div className="visualiser">
        
        <div className="tape-container-wrapper">
          <TapeContainer 
            nodes={nodes}
            edges={edges}
            activeNodeId={activeNodeId}
            setActiveNodeId={setActiveNodeId}
            setActiveEdgeId={setActiveEdgeId}
            setCurrentSymbol={setCurrentSymbol}
            setStepCount={setStepCount} 
            // Pass the loaded input to the tape container
            loadedInput={loadedInput}
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