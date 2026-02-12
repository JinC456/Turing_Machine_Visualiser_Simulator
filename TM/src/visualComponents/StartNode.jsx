/* src/visualComponents/StartNode.jsx */
import React, { useRef } from "react";
import "../Visualiser.css";
import Handles, { useAutoFontSize } from "./Handles";

export default function StartNode({ data = {} }) {
  const labelRef = useRef(null);
  useAutoFontSize(labelRef, data.label);

  const colors = data.threadColors || [];
  
  let nodeStyle = {};
  
  if (data.isActive) {
      if (colors.length === 0) {
          // DTM / MultiTape -> Yellow
          nodeStyle = { borderColor: '#cde81a', borderWidth: '3px' };
      } else if (colors.length === 1) {
          // NTM Single -> Thread Color
          nodeStyle = { borderColor: colors[0], borderWidth: '3px' };
      } else {
          // NTM Multi -> Black
          nodeStyle = { borderColor: 'black', borderWidth: '2px' };
      }
  }
  
  return (
    <div 
      className={`node start ${data.isActive ? 'active' : ''}`}
      style={nodeStyle}
    >
      <span className="arrow">→</span>

      {/* Render Stacked Rings ONLY if multiple threads */}
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

      <div className="node-body">
        {data?.label && (
          <div ref={labelRef} className="node-label">
            {data.label}
          </div>
        )}
      </div>

      <Handles showLeft={false} />
    </div>
  );
}