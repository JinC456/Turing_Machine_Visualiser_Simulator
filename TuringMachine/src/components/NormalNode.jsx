import React from "react";
import { Handle, Position } from "reactflow";
import "../Visualiser.css";

export default function NormalNode() {
  return (
    // creates handle for edge to connect to and shift toward middle of node
    <div className="node normal">
      <Handle type="target" position={Position.Left} id="L" style={{ left: 0.5 }} />
      <Handle type="source" position={Position.Left} id="L" style={{ left: 0.5 }} />
      
      <Handle type="target" position={Position.Right} id="R" style={{ right: 0.5 }} />
      <Handle type="source" position={Position.Right} id="R" style={{ right: 0.5 }} />
      
      <Handle type="target" position={Position.Top} id="T" style={{ top: 0.5 }} />
      <Handle type="source" position={Position.Top} id="T" style={{ top: 0.5 }} />
      
      <Handle type="target" position={Position.Bottom} id="B" style={{ bottom: 0.5 }} />
      <Handle type="source" position={Position.Bottom} id="B" style={{ bottom: 0.5 }} />
    </div>
  );
}
