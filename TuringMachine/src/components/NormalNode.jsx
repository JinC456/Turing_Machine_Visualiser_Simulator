import React from "react";
import { Handle, Position } from "reactflow";
import "../Visualiser.css";

export default function NormalNode() {
  return (
    <div className="node normal">
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
