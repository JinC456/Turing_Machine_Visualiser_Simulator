import React, { useCallback, useState } from "react";
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
import NodeEditMenu from "./NodeEditMenu";

//custom nodes
const nodeTypes = {
  start: StartNode,
  normal: NormalNode,
  accept: AcceptNode,
};

//custome edges
const edgeTypes = {
  draggable: DraggableEdge,
};


export default function DiagramContainer() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { project } = useReactFlow(); // converts screen co-ords to canvas co-ords
  const [selectedNode, setSelectedNode] = useState(null);

  // Handle new edges
  const onConnect = useCallback(
  (params) => {
    setEdges((eds) => {
      const isSelfLoop = params.source === params.target;
      let px, py, sourceX, sourceY, targetX, targetY;

      //shifts position if it is a self loop
      if (isSelfLoop) {
        const node = nodes.find((n) => n.id === params.source);
        const nodeWidth = node.width || 40;
        const nodeHeight = node.height || 40; 
        const loopOffset = 30; 

        sourceX = node.position.x + nodeWidth * 0.25;
        sourceY = node.position.y;

        targetX = node.position.x + nodeWidth * 0.75;
        targetY = node.position.y;

        //curve control point
        px = node.position.x + nodeWidth / 2;
        py = node.position.y - loopOffset;

        
      }

      return [
        ...eds,
        {
          ...params,
          id: `edge-${Date.now()}`, //edge ID
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

  // Drag for nodes from menu
  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  //Drops new node onto canvas
  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("node-type"); //gets node type
      if (!type) return;

      const bounds = event.currentTarget.getBoundingClientRect();
      const position = project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      const nodeWidth = 40;
      const nodeHeight = 40;
      //centres node on drop
      position.x -= nodeWidth / 2;
      position.y -= nodeHeight / 2;

      const newNode = {
        id: `${Date.now()}`, //Node ID
        type,
        position,
        data: { label: "" },
      };

      setNodes((nds) => [...nds, newNode]);
      setSelectedNode(newNode);
      
    },
    [project, setNodes]
  );

  const onNodeDoubleClick = (event, node) => {
    setSelectedNode(node);
  };

  const handleSaveNodeEdit = (id, newLabel, newType) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id ? { ...n, type: newType, data: { ...n.data, label: newLabel } } : n
      )
    );
  };



  //clears all nodes and edges
  const handleClearAll = () => {
    setNodes([]);
    setEdges([]);
  };

  return (
    <div className="diagram-container flex" >
      <NodeMenu /> {/* menu to add nodes */}

      <div className="reactflow-wrapper">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDoubleClick={onNodeDoubleClick}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          fitView
        >
          <Background /> {/* canvas background */}
          <Controls /> {/* background controls */}
        </ReactFlow>
      </div>

      <DiagramControls handleClearAll={handleClearAll} />
      
      {selectedNode && (
        <NodeEditMenu
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onSave={handleSaveNodeEdit}
        />
      )}
    
    </div>
  );
}
