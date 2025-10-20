import React, { useState } from "react";
import NodeMenu from "./NodeMenu";

export default function DiagramContainer() {
  const [nodes, setNodes] = useState([]); 

  const addNodeToDiagram = (type, x, y) => {
    setNodes([...nodes, { type, x: x - 20, y: y - 20 }]); // center node
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("node-type");
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    addNodeToDiagram(type, x, y);
  };

  return (
    <div className="diagram-container">
      <NodeMenu />

      <div
        className="diagram-canvas"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {nodes.map((n, i) => (
          <div
            key={i}
            className="node-container"
            style={{
              position: "absolute",
              left: n.x,
              top: n.y,
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {n.type === "start" && <span className="arrow">→</span>}
            <div className={`node ${n.type}`}>
              {n.type === "accept" && <div className="inner-circle"></div>}
            </div>
          </div>
        ))}
      </div>

      <div className="diagram-controls">
        <button>Save</button>
        <button>Delete</button>
      </div>
    </div>
  );
}
