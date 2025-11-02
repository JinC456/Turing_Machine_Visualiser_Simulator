import React, { useCallback } from "react";
import ReactFlow, {
  useNodesState,
  useEdgesState,
  addEdge,
  Background,
  Controls,
  useReactFlow
} from "reactflow";
import "reactflow/dist/style.css";
import NodeMenu from "./NodeMenu";
import DiagramControls from "./DiagramControls";

import StartNode from "./StartNode";
import NormalNode from "./NormalNode";
import AcceptNode from "./AcceptNode";

const nodeTypes = {
  start: StartNode,
  normal: NormalNode,
  accept: AcceptNode,
};

export default function DiagramContainer({ nodes, edges, setNodes, setEdges }) {
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(nodes);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(edges);


  React.useEffect(() => setRfNodes(nodes), [nodes]);
  React.useEffect(() => setRfEdges(edges), [edges]);

  const { project } = useReactFlow();

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback((event) => {
    event.preventDefault();

    const type = event.dataTransfer.getData("node-type");
    if (!type) return;

    const bounds = event.currentTarget.getBoundingClientRect();

    // Convert screen coordinates to React Flow coordinates
    const position = project({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });

    //center the node under the cursor
    const nodeWidth = 40;
    const nodeHeight = 40;
    position.x -= nodeWidth / 2;
    position.y -= nodeHeight / 2;

    const newNode = {
      id: `${Date.now()}`,
      type, 
      position,
      data: {},
    };

    setNodes((nds) => nds.concat(newNode));
  }, [project, setNodes]);

  const handleClearAll = () => {
    setNodes([]);
    setEdges([]);
  };

  return (
    <div className="diagram-container-wrapper" style={{ display: "flex", gap: "10px" }}>
      <NodeMenu />

      <div style={{ width: "800px", height: "500px", border: "1px solid black" }}>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>

      <DiagramControls handleClearAll={handleClearAll} />
    </div>
  );
}
