import React, { useRef, useLayoutEffect } from "react";
import { Handle, Position } from "reactflow";
import "../Visualiser.css";
import Handles from "./Handles";

export default function StartNode({ data = {} }) {
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
    <div className="node start">
      <span className="arrow">→</span>

      {data?.label && (
        <div ref={labelRef} className="node-label">
          {data.label}
        </div>
      )}

      <Handles/>

    </div>
  );
}
