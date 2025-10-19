import React from 'react';
import NodeMenu from './NodeMenu';
import EdgeMenu from './EdgeMenu';
import ReactFlowCanvas from './Canvas';
import DiagramControls from './DiagramControls';

export default function DiagramContainer({ nodes, edges, setNodes, setEdges }) {
  return (
    <div className="diagram-container">
      <p>This is the diagram container</p>
      <NodeMenu />
      <EdgeMenu />
      <ReactFlowCanvas nodes={nodes} edges={edges} setNodes={setNodes} setEdges={setEdges} />
      <DiagramControls />
    </div>
  );
}
