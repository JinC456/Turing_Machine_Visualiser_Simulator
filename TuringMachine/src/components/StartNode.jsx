import React from "react";
import { Handle, Position } from "reactflow";
import "../Visualiser.css";

export default function StartNode() {
  return (
    <div className="node start">
      <span className="arrow">→</span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
