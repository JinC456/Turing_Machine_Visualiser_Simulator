import React, { useState } from 'react';
import { ReactFlowProvider, useNodesState, useEdgesState } from 'reactflow';

import TapeContainer from './simulatorComponents/TapeContainer';
import DiagramContainer from './visualComponents/DiagramContainer';
import './Visualiser.css';

export default function Visualiser() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [activeNodeId, setActiveNodeId] = useState(null);
  const [activeEdgeId, setActiveEdgeId] = useState(null);
  const [currentSymbol, setCurrentSymbol] = useState("");
  const [stepCount, setStepCount] = useState(0);

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
          />
        </div>

        <div className="diagram-container-wrapper">
          <DiagramContainer 
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