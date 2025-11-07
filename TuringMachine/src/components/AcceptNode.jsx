import React, { useRef, useLayoutEffect } from "react";
import { Handle, Position } from "reactflow";
import "../Visualiser.css";

export default function AcceptNode({ data = {} }) {
 const labelRef = useRef(null);

  useLayoutEffect(() => {
    const element = labelRef.current;
    const parent = element?.parentElement;

    if (!element || !parent) return;

    let currentFontSize = 16;
    element.style.fontSize = `${currentFontSize}px`;

    while (
      (element.scrollWidth > parent.clientWidth || element.scrollHeight > parent.clientHeight) &&
      currentFontSize > 8
    ) {
      currentFontSize -= 0.5;
      element.style.fontSize = `${currentFontSize}px`;
    }
  }, [data.label]);
  
  return (
    // creates handle for edge to connect to and shift toward middle of node
    <div className="node accept">
      <div className="inner-circle">
        {data?.label && (
          <div ref={labelRef} className="node-label">
            {data.label}
          </div>
        )}
      </div>
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
