import React, { useRef } from "react";
import "../Visualiser.css";
import Handles, { useAutoFontSize } from "./Handles";

export default function NormalNode({ data = {} }) {
  const labelRef = useRef(null);
  useAutoFontSize(labelRef, data.label);
  
  return (
    <div className={`node normal ${data.isActive ? 'active' : ''}`}>
      {data?.label && (
        <div ref={labelRef} className="node-label">
          {data.label}
        </div>
      )}
      <Handles showLeft={true} />
    </div>
  );
}