import React, { useState, useEffect } from "react";
import NodeMenu from "./NodeMenu";
import DiagramControls from "./DiagramControls"; 

export default function DiagramContainer() {
  const [nodes, setNodes] = useState([]); 
  const [edges, setEdges] = useState([]); 
  const [draggingNode, setDraggingNode] = useState(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const addNodeToDiagram = (type, x, y) => {
    const id = Date.now(); // unique id
    setNodes([...nodes, { id, type, x: x - 20, y: y - 20 }]); 
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("node-type");
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    addNodeToDiagram(type, x, y);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (draggingNode !== null) {
        setNodes((prevNodes) =>
          prevNodes.map((n) =>
            n.id === draggingNode
              ? { ...n, x: e.clientX - offset.x, y: e.clientY - offset.y }
              : n
          )
        );
      }
    };

    const handleMouseUp = () => setDraggingNode(null);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingNode, offset]);

  const handleClearAll = () => {
    setNodes([]);
    setEdges([]);
  };

  return (
    <div className="diagram-container">
      <NodeMenu />
      <div
        className="diagram-canvas"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {nodes.map((n) => (
          <div
            key={n.id}
            className="node-container"
            style={{
              position: "absolute",
              left: n.x,
              top: n.y,
              display: "flex",
              alignItems: "center",
              cursor: "grab",
            }}
            onMouseDown={(e) => {
              setDraggingNode(n.id);
              setOffset({ x: e.clientX - n.x, y: e.clientY - n.y });
            }}
          >
            {n.type === "start" && <span className="arrow">→</span>}
            <div className={`node ${n.type}`}>
              {n.type === "accept" && <div className="inner-circle"></div>}
            </div>
          </div>
        ))}
      </div>
      <DiagramControls handleClearAll={handleClearAll} />
    </div>
  );
}
