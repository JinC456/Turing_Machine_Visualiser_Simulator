import React from "react";

export default function NodeMenu() {
  return (
    <div className="node-menu">

      <div className="node-menu-item">
        <div
          className="node-container"
          draggable
          onDragStart={(e) => e.dataTransfer.setData("node-type", "start")}
          title="Start state"
        >
          <span className="arrow">→</span>
          <div className="node start" />
        </div>
        <span className="node-menu-label">Start</span>
      </div>

      <div className="node-menu-item">
        <div
          className="node-container"
          draggable
          onDragStart={(e) => e.dataTransfer.setData("node-type", "normal")}
          title="Normal state"
        >
          <div className="node normal" />
        </div>
        <span className="node-menu-label">State</span>
      </div>

      <div className="node-menu-item">
        <div
          className="node-container"
          draggable
          onDragStart={(e) => e.dataTransfer.setData("node-type", "accept")}
          title="Accept state"
        >
          <div className="node accept">
            <div className="inner-circle" />
          </div>
        </div>
        <span className="node-menu-label">Accept</span>
      </div>

    </div>
  );
}