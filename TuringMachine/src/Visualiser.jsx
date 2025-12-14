import React, { useState } from 'react';
import { ReactFlowProvider, useNodesState, useEdgesState } from 'reactflow';

// Update these imports to match your new folder structure
import TapeContainer from './simulatorComponents/TapeContainer';
import DiagramContainer from './visualComponents/DiagramContainer';
import './Visualiser.css';

export default function Visualiser() {
  // 1. The "Program" (Nodes & Edges) lives here
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // 2. The "Active State" (Which node is currently active?)
  const [activeNodeId, setActiveNodeId] = useState(null);

  return (
    <ReactFlowProvider>
      <div className="visualiser">
        
        {/* The Simulator: Needs to know the Rules (edges) and Current State (activeNodeId) */}
        <div className="tape-container-wrapper">
          <TapeContainer 
            nodes={nodes}
            edges={edges}
            activeNodeId={activeNodeId}
            setActiveNodeId={setActiveNodeId}
          />
        </div>

        {/* The Editor: Needs to be able to change the Rules */}
        <div className="diagram-container-wrapper">
          <DiagramContainer 
            nodes={nodes} 
            edges={edges} 
            onNodesChange={onNodesChange} 
            onEdgesChange={onEdgesChange}
            setNodes={setNodes}
            setEdges={setEdges}
            activeNodeId={activeNodeId}
          />
        </div>

      </div>
    </ReactFlowProvider>
  );
}