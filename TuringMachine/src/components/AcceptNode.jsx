import React from "react";
import { Handle, Position } from "reactflow";
import "../Visualiser.css";

export default function AcceptNode() {
  return (
    <div className="node accept">
      <div className="inner-circle"></div>
        <Handle type="target" position={Position.Left} id="L"/>
        <Handle type="source" position={Position.Left} id="L"/>
        <Handle type="target" position={Position.Right} id="R"/>
        <Handle type="source" position={Position.Right} id="R"/>
        <Handle type="target" position={Position.Top} id="T"/>
        <Handle type="source" position={Position.Top} id="T"/>
        <Handle type="target" position={Position.Bottom} id="B"/>
        <Handle type="source" position={Position.Bottom} id="B"/>   
    </div>
  );
}
