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
import CustomConnectionLine from "./ConnectionLine";
import ConvertedDiagramModal from './ConvertedDiagramModal';

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
  isLocked,
  note,
  onNoteChange,
  // Unified history props — provided by Visualiser
  history,
  future,
  pushToHistory,
  handleUndo: handleUndoExternal,
  handleRedo: handleRedoExternal,
}) {

  const [showConvertedDiagram, setShowConvertedDiagram] = useState(false);
  const [showOneWayDiagram, setShowOneWayDiagram] = useState(false);
  const [showNtmDiagram, setShowNtmDiagram] = useState(false);

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
    handleUndoExternal();
  };

  const handleRedo = () => {
    if (isLocked) return;
    handleRedoExternal();
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


  // --- SELF-LOOP SUPPORT ---
  // ReactFlow rejects same-node connections by default, which caused the bug where
  // the preview arc showed a self-loop but dropping it never fired onConnect.
  // Returning true here allows source === target connections through.
  const isValidConnection = useCallback(
    (connection) => {
      if (isLocked) return false;
      return true; // allow self-loops (source === target) as well as normal edges
    },
    [isLocked]
  );

  // Track where a connection drag started so onConnectEnd can detect a self-loop
  // drop even when the user releases over the node body rather than a handle.
  const connectStartRef = useRef(null);

  const onConnectStart = useCallback((event, { nodeId, handleId, handleType }) => {
    connectStartRef.current = { nodeId, handleId, handleType };
  }, []);

  const onConnectEnd = useCallback((event) => {
    if (isLocked) return;
    const originNodeId = connectStartRef.current?.nodeId;
    if (!originNodeId) return;

    // Walk up the DOM from the drop target to find if it landed on the same node
    const target = event.target || event.srcElement;
    const droppedOnNode = target?.closest?.(".react-flow__node");
    if (!droppedOnNode) return;

    const droppedNodeId = droppedOnNode.getAttribute("data-id");
    if (droppedNodeId && droppedNodeId === originNodeId) {
      // The user dragged from a node and released over the same node body.
      // onConnect won't fire in this case (no handle-to-handle), so we create
      // the self-loop manually here.
      // setTimeout(0) lets onConnect fire first if it does — we then check
      // whether a fresh self-loop was already committed before adding one.
      const capturedNodeId = originNodeId;
      const capturedHandleId = connectStartRef.current?.handleId ?? null;
      const capturedNow = Date.now();
      setTimeout(() => {
        setEdges((eds) => {
          const alreadyAdded = eds.some(
            (e) => e.source === capturedNodeId &&
              e.target === capturedNodeId &&
              capturedNow - parseInt(e.id.replace("edge-", ""), 10) < 300
          );
          if (alreadyAdded) return eds; // onConnect already handled it
          const node = nodes.find((n) => n.id === capturedNodeId);
          if (!node) return eds;
          const nodeWidth = node.width || 40;
          const nodeHeight = node.height || 40;
          const loopHeight = nodeHeight * 1.5;
          const py = node.position.y - loopHeight;
          const px = node.position.x + nodeWidth / 2;
          const newEdge = {
            id: `edge-${Date.now()}`,
            source: capturedNodeId,
            target: capturedNodeId,
            sourceHandle: capturedHandleId,
            targetHandle: capturedHandleId,
            type: "draggable",
            markerEnd: { type: MarkerType.ArrowClosed, color: "#333" },
            data: { px, py, t: 0.5, labels: [] },
          };
          pushToHistory("Edge Created");
          setSelectedEdge(newEdge);
          return [...eds, newEdge];
        });
      }, 0);
    }
    connectStartRef.current = null;
  }, [isLocked, nodes, pushToHistory, setEdges]);

  // --- CONNECT ---
  const onConnect = useCallback(
    (params) => {
      if (isLocked) return;
      pushToHistory("Edge Created");

      const isSelfLoop = params.source === params.target;
      let px, py;

      if (isSelfLoop) {
        const node = nodes.find((n) => n.id === params.source);
        if (!node) return;

        const nodeWidth = node.width || 40;
        const nodeHeight = node.height || 40;

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
          ? { px, py, t: 0.5, labels: [] }
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

    const exportData = { nodes: nodes, edges: edges, note: note };
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

    let importedEdges = importedData.edges;

    if (engine === "MultiTape") {
      // Detect how many tape keys the imported data already has
      let maxTape = 0;
      importedEdges.forEach(e => {
        (e.data?.labels || []).forEach(l => {
          Object.keys(l).forEach(k => {
            if (k.startsWith('tape')) {
              const n = parseInt(k.replace('tape', ''), 10);
              if (!isNaN(n)) maxTape = Math.max(maxTape, n);
            }
          });
        });
      });

      if (maxTape === 0) {
        // Single-tape import: wrap read/write/direction into tape1,
        // and add tape2 with blank/blank/N defaults.
        importedEdges = importedEdges.map(e => ({
          ...e,
          data: {
            ...e.data,
            labels: (e.data?.labels || []).map(({ read, write, direction, ...rest }) => ({
              ...rest,
              tape1: { read: read ?? '\u2423', write: write ?? '\u2423', direction: direction ?? 'R' },
              tape2: { read: '\u2423', write: '\u2423', direction: 'N' },
            })),
          },
        }));
      } else {
        // Already has tape keys — pad any missing tapes up to max(existing, 2)
        const minTapes = Math.max(maxTape, 2);
        importedEdges = importedEdges.map(e => ({
          ...e,
          data: {
            ...e.data,
            labels: (e.data?.labels || []).map(l => {
              const padded = { ...l };
              for (let t = 1; t <= minTapes; t++) {
                if (!padded[`tape${t}`]) {
                  padded[`tape${t}`] = { read: '\u2423', write: '\u2423', direction: 'N' };
                }
              }
              return padded;
            }),
          },
        }));
      }
    }

    pushToHistory("Imported Diagram");
    setNodes(importedData.nodes);
    setEdges(importedEdges);
    onNoteChange(importedData.note ?? "");
    setSelectedNode(null);
    setSelectedEdge(null);
  }, [pushToHistory, setNodes, setEdges, onNoteChange, isLocked, engine]);

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
            : (isActive ? "#e8d71a" : "#333"), 
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
      <div className="diagram-container">
        <NodeMenu />

        <div className={`reactflow-wrapper ${isLocked ? "locked" : ""}`}>
          <ReactFlow
            nodes={decoratedNodes}
            edges={decoratedEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionLineComponent={CustomConnectionLine}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDoubleClick={onNodeDoubleClick}
            onNodeContextMenu={onNodeContextMenu}
            onEdgeDoubleClick={onEdgeDoubleClick}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            isValidConnection={isValidConnection}
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
            connectionRadius={40}
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>

        <DiagramControls
          onClearAll={handleClearAll}  
          onUndo={handleUndo}         
          onRedo={handleRedo}
          onExport={handleExport}
          onImport={handleImport}
          canUndo={!isLocked && history.length > 0}
          canRedo={!isLocked && future.length > 0}
          isLocked={isLocked} 
          engine={engine}
          onConvert={(mode) => {
            if (mode === "combined") setShowConvertedDiagram(true);
            if (mode === "oneWay") setShowOneWayDiagram(true);
            if (mode === "ntm") setShowNtmDiagram(true);
          }}

          note={note}
          onNoteChange={onNoteChange}
        />

      

        {showConvertedDiagram && (
          <ConvertedDiagramModal
            nodes={nodes}
            edges={edges}
            onClose={() => setShowConvertedDiagram(false)}
            mode="singleTape"
          />
        )}

        {showOneWayDiagram && (
          <ConvertedDiagramModal
            nodes={nodes}
            edges={edges}
            onClose={() => setShowOneWayDiagram(false)}
            mode="oneWay"
          />
        )}

        {showNtmDiagram && (
          <ConvertedDiagramModal
            nodes={nodes}
            edges={edges}
            onClose={() => setShowNtmDiagram(false)}
            mode="ntm"
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