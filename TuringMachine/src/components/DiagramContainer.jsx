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
// 1. Import HistoryContext from DraggableEdge
import DraggableEdge, { HistoryContext } from "./DraggableEdge";
import NodeEditMenu from "./NodeEditMenu";
import EdgeMenu from "./EdgeMenu";

// Custom nodes
const nodeTypes = {
  start: StartNode,
  normal: NormalNode,
  accept: AcceptNode,
};

// Custom edges
const edgeTypes = {
  draggable: DraggableEdge,
};

export default function DiagramContainer() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { project } = useReactFlow();
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);

  // History stacks
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);

  const pushToHistory = useCallback(() => {
    const clonedNodes = nodes.map((n) => ({ ...n, data: { ...n.data } }));
    const clonedEdges = edges.map((e) => ({
      ...e,
      data: {
        ...e.data,
        labels: [...(e.data.labels || [])],
      },
    }));

    setHistory((h) => {
      const newHistory = [...h, { nodes: clonedNodes, edges: clonedEdges }];
      // Keep only the last 10
      return newHistory.slice(-10);
    });
    setFuture([]); // clear redo stack
  }, [nodes, edges]);


  const updateNodes = useCallback(
    (updater) => {
      pushToHistory();
      setNodes(updater);
    },
    [pushToHistory, setNodes]
  );

  const updateEdges = useCallback(
    (updater) => {
      pushToHistory();
      setEdges(updater);
    },
    [pushToHistory, setEdges]
  );

  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((h) => h.slice(0, h.length - 1));
    setFuture((f) => [...f, { nodes, edges }]);
    setNodes(previous.nodes);
    setEdges(previous.edges);
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    const next = future[future.length - 1];
    setFuture((f) => f.slice(0, f.length - 1));
    setHistory((h) => [...h, { nodes, edges }]);
    setNodes(next.nodes);
    setEdges(next.edges);
  };

  const onConnect = useCallback(
    (params) => {
      pushToHistory(); 

      const isSelfLoop = params.source === params.target;
      let px, py, sourceX, sourceY, targetX, targetY;

      if (isSelfLoop) {
        const node = nodes.find((n) => n.id === params.source);
        const nodeWidth = node.width || 40;
        const loopOffset = 30;

        sourceX = node.position.x + nodeWidth * 0.25;
        sourceY = node.position.y;
        targetX = node.position.x + nodeWidth * 0.75;
        targetY = node.position.y;

        px = node.position.x + nodeWidth / 2;
        py = node.position.y - loopOffset;
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
        data: { label: "" },
      };

      pushToHistory();
      setNodes((nds) => [...nds, newNode]);
      setSelectedNode(newNode);
    },
    [project, pushToHistory, setNodes]
  );

  const onNodeDoubleClick = (event, node) => {
    event.preventDefault();
    setSelectedNode(node);
    setSelectedEdge(null);
  };

  const onEdgeDoubleClick = (event, edge) => {
    event.preventDefault();
    setSelectedEdge(edge);
    setSelectedNode(null);
  };

  const handleSaveNodeEdit = (id, newLabel, newType) => {

    const node = nodes.find((n) => n.id === id);
    if (node && node.data.label && node.data.label.trim() !== "") {
      pushToHistory();
    }
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
    const edge = edges.find((e) => e.id === id);

    if (edge && edge.data.labels && edge.data.labels.length > 0) {
      pushToHistory();
    }

    setEdges((eds) =>
      eds.map((e) =>
        e.id === id ? { ...e, data: { ...e.data, labels: newLabels } } : e
      )
    );
    setSelectedEdge(null);
  };

  const handleDeleteEdge = (id) => {
    setEdges((eds) => eds.filter((e) => e.id !== id));
    setSelectedEdge(null);
  };

  

  const handleClearAll = () => {
    pushToHistory();
    setNodes([]);
    setEdges([]);
  };

  return (
    /* 2. Wrap everything in Provider */
    <HistoryContext.Provider value={pushToHistory}>
      <div className="diagram-container flex">
        <NodeMenu />

        <div className="reactflow-wrapper">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDoubleClick={onNodeDoubleClick}
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