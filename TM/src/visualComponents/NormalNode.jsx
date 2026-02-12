import React, { useRef } from "react";
import "../Visualiser.css";
import Handles, { useAutoFontSize } from "./Handles";

export default function NormalNode({ data = {} }) {
  const labelRef = useRef(null);
  useAutoFontSize(labelRef, data.label);
  
  const colors = data.threadColors || [];
  
  return (
    <div className={`node normal ${data.isActive ? 'active' : ''}`}>
      {/* RINGS: Render for ALL threads (including the first one) */}
      {colors.map((color, idx) => (
        <div 
          key={idx}
          className="node-ring"
          style={{ 
            borderColor: color,
            /* Start larger than the 50px node */
            width: `${60 + (idx * 10)}px`, 
            height: `${60 + (idx * 10)}px`,
            zIndex: -1 - idx // Stack behind
          }}
        />
      ))}
      
      {/* Node Body */}
      <div className="node-body">
        {data?.label && (
          <div ref={labelRef} className="node-label">
            {data.label}
          </div>
        )}
      </div>
      <Handles showLeft={true} />
    </div>
  );
}