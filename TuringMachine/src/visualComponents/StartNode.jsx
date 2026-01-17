import React, { useRef } from "react";
import "../Visualiser.css";
import Handles, { useAutoFontSize } from "./Handles";

export default function StartNode({ data = {} }) {
  const labelRef = useRef(null);
  useAutoFontSize(labelRef, data.label);
  
  return (
    <div className={`node start ${data.isActive ? 'active' : ''}`}>
      <span className="arrow">→</span>

      {data?.label && (
        <div ref={labelRef} className="node-label">
          {data.label}
        </div>
      )}

      <Handles showLeft={false} />
    </div>
  );
}