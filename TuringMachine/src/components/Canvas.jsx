import React from 'react';

export default function Canvas({ nodes, setNodes, draggingNode, setDraggingNode, offset, setOffset }) {

  const handleMouseDown = (e, n) => {
    setDraggingNode(n.id);
    setOffset({ x: e.clientX - n.x, y: e.clientY - n.y });
  };

  //adds node to array
  const handleDrop = (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("node-type");
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now(); //create unique Id for node
    setNodes([...nodes, { id, type, x: x - 20, y: y - 20 }]);
  };

  return (
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
          onMouseDown={(e) => handleMouseDown(e, n)}
        >
          {n.type === "start" && <span className="arrow">→</span>}
          <div className={`node ${n.type}`}>
            {n.type === "accept" && <div className="inner-circle"></div>}
          </div>
        </div>
      ))}
    </div>
  );
}
