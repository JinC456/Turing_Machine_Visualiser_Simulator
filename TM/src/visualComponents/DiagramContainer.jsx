import React, { useCallback, useState, useEffect, useMemo, useRef } from "react";
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
import SingleTapeModal from "../simulatorComponents/singleTapeModal";


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
  stepCount,
  engine,
  onClear,
  isLocked
}) {
  const [showSingleTapeModal, setShowSingleTapeModal] = useState(false);
  const { project, fitView } = useReactFlow();

  const globalTapeCount = useMemo(() => {
    if (engine !== "MultiTape") return 1;
    let max = 2;
    edges.forEach(e => {
      if (e.data?.labels) {
        e.data.labels.forEach(l => {
          Object.keys(l).forEach(k => {
            if (k.startsWith("tape")) {
              const num = parseInt(k.replace("tape", ""), 10);
              if (!isNaN(num)) max = Math.max(max, num);
            }
          });
        });
      }
    });
    return max;
  }, [edges, engine]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fitView({ padding: 0.4, duration: 0 });
    }, 100);
    
    return () => clearTimeout(timer);
  }, [fitView]);

  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);

  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  
  const historyCounter = useRef(0);

  // --- HISTORY ---
  const pushToHistory = useCallback((label = "Unknown Action", snapshotOverride = null) => {
    historyCounter.current += 1;
    const actionId = historyCounter.current;
    
    const sourceNodes = snapshotOverride ? snapshotOverride.nodes : nodes;
    const sourceEdges = snapshotOverride ? snapshotOverride.edges : edges;

    const clonedNodes = sourceNodes.map((n) => ({ ...n, data: { ...n.data } }));
    const clonedEdges = sourceEdges.map((e) => ({
      ...e,
      data: {
        ...e.data,
        labels: JSON.parse(JSON.stringify(e.data.labels || [])),
      },
    }));

    setHistory((h) =>
      [...h, { 
        nodes: clonedNodes, 
        edges: clonedEdges,
        metadata: { id: actionId, label } 
      }].slice(-50)
    );
    setFuture([]);
  }, [nodes, edges]);

  // --- DEBOUNCED HISTORY ---
  const historyTimeoutRef = useRef(null);

  const pushToHistoryDebounced = useCallback((label) => {
    if (historyTimeoutRef.current) {
      clearTimeout(historyTimeoutRef.current);
    }
    
    historyTimeoutRef.current = setTimeout(() => {
      pushToHistory(label);
      historyTimeoutRef.current = null;
    }, 200);
  }, [pushToHistory]);

  const handleUndo = () => {
    if (isLocked) return;
    if (history.length === 0) return;

    const previous = history[history.length - 1];
    
    const currentSnapshot = { 
        nodes: nodes.map(n => ({ ...n, data: { ...n.data } })), 
        edges: edges.map(e => ({ ...e, data: { ...e.data, labels: JSON.parse(JSON.stringify(e.data.labels || [])) } })) 
    };

    setHistory((h) => h.slice(0, -1));
    setFuture((f) => [...f, { ...currentSnapshot, metadata: previous.metadata }]);
    
    setNodes(previous.nodes);
    setEdges(previous.edges);
  };

  const handleRedo = () => {
    if (isLocked) return;
    if (future.length === 0) return;

    const next = future[future.length - 1];
    
    const currentSnapshot = { 
        nodes: nodes.map(n => ({ ...n, data: { ...n.data } })), 
        edges: edges.map(e => ({ ...e, data: { ...e.data, labels: JSON.parse(JSON.stringify(e.data.labels || [])) } })) 
    };

    setFuture((f) => f.slice(0, -1));
    setHistory((h) => [...h, { ...currentSnapshot, metadata: next.metadata }]);
    
    setNodes(next.nodes);
    setEdges(next.edges);
  };

  // --- DRAG SNAPSHOT LOGIC ---
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragStartSnapshotRef = useRef(null); 

  // 1. Single Node Drag
  const onNodeDragStart = useCallback((event, node) => {
      if (isLocked) return;
      dragStartRef.current = { x: node.position.x, y: node.position.y };
      dragStartSnapshotRef.current = { nodes, edges };
  }, [nodes, edges, isLocked]);

  const onNodeDragStop = useCallback((event, node) => {
      if (isLocked) return;
      const dx = node.position.x - dragStartRef.current.x;
      const dy = node.position.y - dragStartRef.current.y;
      const distance = Math.sqrt(dx*dx + dy*dy);

      if (distance > 5 && dragStartSnapshotRef.current) {
          pushToHistory("Node Moved", dragStartSnapshotRef.current);
      }
      dragStartSnapshotRef.current = null; 
  }, [pushToHistory, isLocked]);

  // 2. Multi-Selection Drag
  const onSelectionDragStart = useCallback(() => {
      if (isLocked) return;
      dragStartSnapshotRef.current = { nodes, edges };
  }, [nodes, edges, isLocked]);

  const onSelectionDragStop = useCallback(() => {
      if (isLocked) return;
      if (dragStartSnapshotRef.current) {
          pushToHistory("Group Moved", dragStartSnapshotRef.current);
          dragStartSnapshotRef.current = null;
      }
  }, [pushToHistory, isLocked]);


  // --- CONNECT ---
  const onConnect = useCallback(
    (params) => {
      if (isLocked) return;
      pushToHistory("Edge Created");

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
    [nodes, pushToHistory, setEdges, isLocked]
  );

  // --- DRAG & DROP NEW NODES ---
  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      if (isLocked) return;

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

      pushToHistory("Node Created");
      setNodes((nds) => [...nds, newNode]);
    },
    [project, pushToHistory, setNodes, nodes.length, isLocked]
  );

  // --- NODE INTERACTIONS ---
  const onNodeDoubleClick = (event, node) => {
    event.preventDefault();
    if (isLocked) return;
    if (node.type !== "normal" && node.type !== "accept") return;
    
    pushToHistory("Node Type Changed");

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
    if (isLocked) return;
    setSelectedNode(node);
    setSelectedEdge(null);
  };

  const onEdgeDoubleClick = (event, edge) => {
    event.preventDefault();
    if (isLocked) return;
    setSelectedEdge(edge);
    setSelectedNode(null);
  };

  // --- SAVE / DELETE ---
  const handleSaveNodeEdit = (id, newLabel, newType) => {
    pushToHistory("Node Edited");
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id
          ? { ...n, type: newType, data: { ...n.data, label: newLabel } }
          : n
      )
    );
    setSelectedNode(null);
  };

  const handleSaveEdgeEdit = (id, newLabels, pendingOps = []) => {
    pushToHistory("Edge Edited");

    setEdges((eds) => {
      return eds.map((e) => {
        if (e.id === id) {
          return { ...e, data: { ...e.data, labels: newLabels } };
        }
        
        if (engine === "MultiTape" && pendingOps.length > 0) {
            let updatedLabels = (e.data.labels || []).map(label => {
                let currentLabel = { ...label };
                pendingOps.forEach(op => {
                    if (op.type === 'ADD') {
                        let max = 0;
                        Object.keys(currentLabel).forEach(k => {
                            if (k.startsWith('tape')) {
                                const n = parseInt(k.replace('tape',''),10);
                                if (!isNaN(n)) max = Math.max(max, n);
                            }
                        });
                        currentLabel[`tape${max+1}`] = { read: "␣", write: "␣", direction: 'N' };
                    } else if (op.type === 'DELETE') {
                        const idx = op.index;
                        const newLabelObj = {};
                        Object.keys(currentLabel).forEach(k => {
                            if (!k.startsWith('tape')) newLabelObj[k] = currentLabel[k];
                        });
                        let max = 0;
                        Object.keys(currentLabel).forEach(k => {
                            if (k.startsWith('tape')) {
                                const n = parseInt(k.replace('tape',''),10);
                                if (!isNaN(n)) max = Math.max(max, n);
                            }
                        });
                        let newIndex = 1;
                        for (let i=1; i<=max; i++) {
                            if (i === idx) continue; 
                            const oldKey = `tape${i}`;
                            const newKey = `tape${newIndex}`;
                            if (currentLabel[oldKey]) {
                                newLabelObj[newKey] = currentLabel[oldKey];
                            }
                            newIndex++;
                        }
                        currentLabel = newLabelObj;
                    }
                });
                return currentLabel;
            });
            return { ...e, data: { ...e.data, labels: updatedLabels } };
        }
        return e;
      });
    });

    setSelectedEdge(null);
  };

  const handleDeleteEdge = (id) => {
    pushToHistory("Edge Deleted");
    setEdges((eds) => eds.filter((e) => e.id !== id));
    setSelectedEdge(null);
  };

  const handleClearAll = () => {
    if (isLocked) return;
    pushToHistory("Cleared All");
    if (onClear) {
      onClear();
    } else {
      setNodes([]);
      setEdges([]);
    }
  };

  const handleExport = () => {
    let filename = window.prompt("Enter a filename for the export:", "turing_machine_diagram");
    if (filename === null) return;
    if (filename.trim() === "") filename = "turing_machine_diagram";
    if (!filename.toLowerCase().endsWith(".json")) filename += ".json";

    const exportData = { nodes: nodes, edges: edges };
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = href;
    link.download = filename; 
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
  };

  const handleImport = useCallback((importedData) => {
    if (isLocked) return;
    if (!importedData || typeof importedData !== 'object') {
        alert("Invalid file format.");
        return;
    }
    if (!Array.isArray(importedData.nodes) || !Array.isArray(importedData.edges)) {
        alert("Invalid JSON: File must contain 'nodes' and 'edges' arrays.");
        return;
    }

    pushToHistory("Imported Diagram");
    setNodes(importedData.nodes);
    setEdges(importedData.edges);
    setSelectedNode(null);
    setSelectedEdge(null);
  }, [pushToHistory, setNodes, setEdges, isLocked]);

  // --- RENDER PREP ---

  const decoratedNodes = nodes.map((node) => {
    let activeThreadColors = [];
    
    if (engine === "NonDeterministic" && Array.isArray(activeNodeId)) {
      activeThreadColors = activeNodeId
        // FIXED: Include 'accepted' threads so the final step remains visible
        .filter(t => t.currentNodeId === node.id && (t.status === 'active' || t.status === 'accepted'))
        .map(t => t.color);
    }

    return {
      ...node,
      data: {
        ...node.data,
        isActive: engine === "NonDeterministic" ? activeThreadColors.length > 0 : node.id === activeNodeId,
        threadColors: activeThreadColors
      },
    };
  });

  const decoratedEdges = edges.map((edge) => {
    let isActive = edge.id === activeEdgeId;
    let activeThreadColors = [];
    let activeThreadsOnEdge = [];

    // NTM Logic: Find threads traversing this edge
    if (engine === "NonDeterministic" && Array.isArray(activeNodeId)) {
       // FIXED: Include 'accepted' threads so the final edge traversal remains highlighted
       activeThreadsOnEdge = activeNodeId.filter(t => t.activeEdgeId === edge.id && (t.status === 'active' || t.status === 'accepted'));
       
       if (activeThreadsOnEdge.length > 0) {
           isActive = true;
           activeThreadColors = activeThreadsOnEdge.map(t => t.color);
       }
    }

    return {
      ...edge,
      markerEnd: {
        ...edge.markerEnd,
        // NTM: Use top thread color. DTM: Use Yellow (active) or Grey (inactive)
        color: activeThreadColors.length > 0 
            ? activeThreadColors[activeThreadColors.length - 1] 
            : (isActive ? "#cde81a" : "#333"), 
      },
      data: {
        ...edge.data,
        isActive: isActive,
        activeSymbol: isActive ? currentSymbol : null,
        stepCount: isActive ? stepCount : null,
        threadColors: activeThreadColors,
        activeThreads: activeThreadsOnEdge // Pass threads to edge for badge logic
      },
    };
  });

  return (
    <HistoryContext.Provider value={pushToHistory}>
      <div className="diagram-container flex">
        <NodeMenu />

        <div className={`reactflow-wrapper ${isLocked ? "locked" : ""}`}>
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
            nodesDraggable={!isLocked}
            nodesConnectable={!isLocked}
            deleteKeyCode={isLocked ? null : ["Backspace", "Delete"]}
            onNodeDragStart={onNodeDragStart} 
            onNodeDragStop={onNodeDragStop}   
            onSelectionDragStart={onSelectionDragStart}
            onSelectionDragStop={onSelectionDragStop}
            onNodesDelete={() => !isLocked && pushToHistoryDebounced("Nodes Deleted")}
            onEdgesDelete={() => !isLocked && pushToHistoryDebounced("Edges Deleted")}
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
          handleExport={handleExport}
          handleImport={handleImport} 
          canUndo={!isLocked && history.length > 0}
          canRedo={!isLocked && future.length > 0}
          isLocked={isLocked} 
          engine={engine}
          onConvert={() => {
              if (engine === "MultiTape") {
                  setShowSingleTapeModal(true);
              }
          }}
        />

        {showSingleTapeModal && (
          <SingleTapeModal 
            nodes={nodes} 
            edges={edges}
            initialInput={nodes.find(n => n.type === 'start')?.data?.input || ""}
            onClose={() => setShowSingleTapeModal(false)} 
          />
        )}


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
            engine={engine}
            globalTapeCount={globalTapeCount} 
          />
        )}
      </div>
    </HistoryContext.Provider>
  );
}