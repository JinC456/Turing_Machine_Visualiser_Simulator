import React, { useCallback } from "react";
import ReactFlow, {
  useNodesState,
  useEdgesState,
  MarkerType,
  Background,
  Controls,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";

import NodeMenu from "./NodeMenu";
import DiagramControls from "./DiagramControls";
import StartNode from "./StartNode";
import NormalNode from "./NormalNode";
import AcceptNode from "./AcceptNode";
import DraggableEdge from "./DraggableEdge";

const nodeTypes = {
  start: StartNode,
  normal: NormalNode,
  accept: AcceptNode,
};

const edgeTypes = {
  draggable: DraggableEdge,
};

export default function DiagramContainer() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { project } = useReactFlow();

  // Handle new edges
  const onConnect = useCallback(
  (params) => {
    setEdges((eds) => {
      const isSelfLoop = params.source === params.target;
      let px, py, sourceX, sourceY, targetX, targetY;

      if (isSelfLoop) {
        const node = nodes.find((n) => n.id === params.source);
        const nodeWidth = node.width || 40;
        const nodeHeight = node.height || 40; 
        const loopOffset = 30; 

 

   
        sourceX = node.position.x + nodeWidth * 0.25;
        sourceY = node.position.y;


        targetX = node.position.x + nodeWidth * 0.75;
        targetY = node.position.y;


        px = node.position.x + nodeWidth / 2;
        py = node.position.y - loopOffset;

        
      }

      return [
        ...eds,
        {
          ...params,
          id: `edge-${Date.now()}`,
          type: "draggable", 
          markerEnd: { type: MarkerType.ArrowClosed, color: "#333" },
          data: isSelfLoop
            ? { px, py, t: 0.5, sourceX, sourceY, targetX, targetY }
            : { px: undefined, py: undefined, t: 0.5 },
        },
      ];
    });
  },
  [nodes, setEdges]
);

  // Drag & drop for nodes
  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("node-type");
      if (!type) return;

      const bounds = event.currentTarget.getBoundingClientRect();
      const position = project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

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

      setNodes((nds) => [...nds, newNode]);
    },
    [project, setNodes]
  );

  const handleClearAll = () => {
    setNodes([]);
    setEdges([]);
  };

  return (
    <div className="diagram-container flex" style={{ display: "flex", gap: "10px" }}>
      <NodeMenu />

      <div style={{ width: "800px", height: "500px", border: "1px solid black" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
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
