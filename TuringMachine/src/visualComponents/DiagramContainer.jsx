import React, { useCallback, useState } from "react";
import ReactFlow, {
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
import DraggableEdge, { HistoryContext } from "./DraggableEdge";
import NodeEditMenu from "./NodeEditMenu";
import EdgeMenu from "./EdgeMenu";

const nodeTypes = {
  start: StartNode,
  normal: NormalNode,
  accept: AcceptNode,
};

const edgeTypes = {
  draggable: DraggableEdge,
};

export default function DiagramContainer({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  setNodes,
  setEdges,
  activeNodeId,
  activeEdgeId,
  currentSymbol,
  stepCount
}) {
  const { project } = useReactFlow();

  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);

  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);

  // --- HISTORY ---
  const pushToHistory = useCallback(() => {
    const clonedNodes = nodes.map((n) => ({ ...n, data: { ...n.data } }));
    const clonedEdges = edges.map((e) => ({
      ...e,
      data: {
        ...e.data,
        labels: [...(e.data.labels || [])],
      },
    }));

    setHistory((h) =>
      [...h, { nodes: clonedNodes, edges: clonedEdges }].slice(-10)
    );
    setFuture([]);
  }, [nodes, edges]);

  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setFuture((f) => [...f, { nodes, edges }]);
    setNodes(previous.nodes);
    setEdges(previous.edges);
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    const next = future[future.length - 1];
    setFuture((f) => f.slice(0, -1));
    setHistory((h) => [...h, { nodes, edges }]);
    setNodes(next.nodes);
    setEdges(next.edges);
  };

  // --- CONNECT ---
  const onConnect = useCallback(
    (params) => {
      pushToHistory();

      const isSelfLoop = params.source === params.target;
      let px, py, sourceX, sourceY, targetX, targetY;

      if (isSelfLoop) {
        const node = nodes.find((n) => n.id === params.source);
        if (!node) return;

        const nodeWidth = node.width || 40;
        const nodeHeight = node.height || 40;

        sourceX = node.position.x + nodeWidth * 0.25;
        targetX = node.position.x + nodeWidth * 0.75;

        sourceY = node.position.y + nodeHeight / 2;
        targetY = node.position.y + nodeHeight / 2;

        const loopHeight = nodeHeight * 1.5;
        py = node.position.y - loopHeight;
        px = node.position.x + nodeWidth / 2;
      }

      const newEdge = {
        ...params,
        id: `edge-${Date.now()}`,
        type: "draggable",
        markerEnd: { type: MarkerType.ArrowClosed, color: "#333" },
        data: isSelfLoop
          ? { px, py, t: 0.5, sourceX, sourceY, targetX, targetY, labels: [] }
          : { px: undefined, py: undefined, t: 0.5, labels: [] },
      };

      setEdges((eds) => [...eds, newEdge]);
      setSelectedEdge(newEdge);
    },
    [nodes, pushToHistory, setEdges]
  );

  // --- DRAG & DROP ---
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

      position.x -= 20;
      position.y -= 20;

      const newNode = {
        id: `${Date.now()}`,
        type,
        position,
        data: { label: `S${nodes.length}` },
      };

      pushToHistory();
      setNodes((nds) => [...nds, newNode]);
    },
    [project, pushToHistory, setNodes, nodes.length]
  );

  // --- NODE INTERACTIONS ---

  const onNodeDoubleClick = (event, node) => {
    event.preventDefault();
    if (node.type !== "normal" && node.type !== "accept") return;
    pushToHistory();

    setNodes((nds) =>
      nds.map((n) =>
        n.id === node.id
          ? { ...n, type: n.type === "normal" ? "accept" : "normal" }
          : n
      )
    );
  };

  const onNodeContextMenu = (event, node) => {
    event.preventDefault();
    setSelectedNode(node);
    setSelectedEdge(null);
  };

  const onEdgeDoubleClick = (event, edge) => {
    event.preventDefault();
    setSelectedEdge(edge);
    setSelectedNode(null);
  };

  // --- SAVE / DELETE ---
  const handleSaveNodeEdit = (id, newLabel, newType) => {
    pushToHistory();
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id
          ? { ...n, type: newType, data: { ...n.data, label: newLabel } }
          : n
      )
    );
    setSelectedNode(null);
  };

  const handleSaveEdgeEdit = (id, newLabels) => {
    pushToHistory();
    setEdges((eds) =>
      eds.map((e) =>
        e.id === id ? { ...e, data: { ...e.data, labels: newLabels } } : e
      )
    );
    setSelectedEdge(null);
  };

  const handleDeleteEdge = (id) => {
    pushToHistory();
    setEdges((eds) => eds.filter((e) => e.id !== id));
    setSelectedEdge(null);
  };

  const handleClearAll = () => {
    pushToHistory();
    setNodes([]);
    setEdges([]);
  };

  const decoratedNodes = nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      isActive: node.id === activeNodeId,
    },
  }));

  const decoratedEdges = edges.map((edge) => {
    const isActive = edge.id === activeEdgeId;
    return {
      ...edge,
      markerEnd: 
      {
        ...edge.markerEnd,
        color: isActive ? "#c7b52a" : "#333", 
      },
      data: {
        ...edge.data,
        isActive: isActive,
        activeSymbol: isActive ? currentSymbol : null,
        // Pass stepCount only if active to trigger re-render
        stepCount: isActive ? stepCount : null 
      },
    };
  });

  return (
    <HistoryContext.Provider value={pushToHistory}>
      <div className="diagram-container flex">
        <NodeMenu />

        <div className="reactflow-wrapper">
          <ReactFlow
            nodes={decoratedNodes}
            edges={decoratedEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDoubleClick={onNodeDoubleClick}
            onNodeContextMenu={onNodeContextMenu}
            onEdgeDoubleClick={onEdgeDoubleClick}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>

        <DiagramControls
          handleClearAll={handleClearAll}
          Undo={handleUndo}
          Redo={handleRedo}
        />

        {selectedNode && (
          <NodeEditMenu
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
            onSave={handleSaveNodeEdit}
          />
        )}

        {selectedEdge && (
          <EdgeMenu
            edge={selectedEdge}
            onClose={() => setSelectedEdge(null)}
            onSave={handleSaveEdgeEdit}
            onDelete={handleDeleteEdge}
          />
        )}
      </div>
    </HistoryContext.Provider>
  );
}