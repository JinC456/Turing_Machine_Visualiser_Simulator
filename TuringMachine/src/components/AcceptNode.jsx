import React from "react";
import { Handle, Position } from "reactflow";
import "../Visualiser.css";

export default function AcceptNode() {
  return (
    <div className="node accept">
      <div className="inner-circle"></div>
      <Handle type="target" position={Position.Left} />
    </div>
  );
}
