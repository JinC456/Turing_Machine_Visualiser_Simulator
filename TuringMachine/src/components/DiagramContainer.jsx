import React, { useState, useEffect } from "react";
import NodeMenu from "./NodeMenu";
import DiagramControls from "./DiagramControls";
import Canvas from "./Canvas";

export default function DiagramContainer() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [draggingNode, setDraggingNode] = useState(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

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
      <Canvas
        nodes={nodes}
        setNodes={setNodes}
        draggingNode={draggingNode}
        setDraggingNode={setDraggingNode}
        offset={offset}
        setOffset={setOffset}
      />
      <DiagramControls handleClearAll={handleClearAll} />
    </div>
  );
}
