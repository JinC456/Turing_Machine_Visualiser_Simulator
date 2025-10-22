import React, { useState, useEffect } from "react";
import NodeMenu from "./NodeMenu";
import DiagramControls from "./DiagramControls";
import Canvas from "./Canvas";

export default function DiagramContainer() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [draggingNode, setDraggingNode] = useState(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // moves node as it gets dragged + updates position based off mouse coordinates
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (draggingNode !== null) {
        setNodes((prevNodes) =>
          prevNodes.map((n) => {
            if (n.id === draggingNode) {
              return { ...n, x: e.clientX - offset.x, y: e.clientY - offset.y }; //update x and y only
            } else {
              return n;
            }
          }));
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

  //clears all nodes and edges
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
