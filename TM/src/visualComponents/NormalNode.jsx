/* src/visualComponents/NormalNode.jsx */
import React, { useRef } from "react";
import "../Visualiser.css";
import Handles, { useAutoFontSize } from "./Handles";

export default function NormalNode({ data = {} }) {
  const labelRef = useRef(null);
  useAutoFontSize(labelRef, data.label);
  
  const colors = data.threadColors || [];
  
  // Determine border style for the Node itself
  let nodeStyle = {};
  
  if (data.isActive) {
      if (colors.length === 0) {
          // DTM / MultiTape Active -> Default Yellow Border
          nodeStyle = { borderColor: '#e8d71a', borderWidth: '3px' };
      } else if (colors.length === 1) {
          // NTM Single Thread -> Thread Color Border
          nodeStyle = { borderColor: colors[0], borderWidth: '3px' };
      } else {
          // NTM Multi Thread -> Neutral Black Border (Rings are outside)
          nodeStyle = { borderColor: 'black', borderWidth: '2px' };
      }
  }

  return (
    <div 
      className={`node normal ${data.isActive ? 'active' : ''}`}
      style={nodeStyle}
    >
      {/* Render Stacked Rings ONLY if multiple threads (NTM) */}
      {colors.length > 1 && colors.map((color, idx) => (
        <div 
          key={idx}
          className="node-ring"
          style={{ 
            borderColor: color,
            width: `${50 + (idx * 8)}px`,
            height: `${50 + (idx * 8)}px`,
            zIndex: -idx
          }}
        />
      ))}
      
      {/* Main Node Body (Transparent, contains label) */}
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