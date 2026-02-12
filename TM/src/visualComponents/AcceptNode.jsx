/* src/visualComponents/AcceptNode.jsx */
import React, { useRef } from "react";
import "../Visualiser.css";
import Handles, { useAutoFontSize } from "./Handles";

export default function AcceptNode({ data = {} }) {
  const labelRef = useRef(null);
  useAutoFontSize(labelRef, data.label);

  const colors = data.threadColors || [];
  
  return (
    <div className={`node accept ${data.isActive ? 'active' : ''}`}>
      {/* RINGS: Render for ALL threads */}
      {colors.map((color, idx) => (
        <div 
          key={idx}
          className="node-ring"
          style={{ 
            borderColor: color,
            width: `${60 + (idx * 10)}px`,
            height: `${60 + (idx * 10)}px`,
            zIndex: -1 - idx
          }}
        />
      ))}

      <div className="node-body">
        <div className="inner-circle">
          {data?.label && (
            <div ref={labelRef} className="node-label">
              {data.label}
            </div>
          )}
        </div>
      </div>
      <Handles showLeft={true}/>
    </div>
  );
}