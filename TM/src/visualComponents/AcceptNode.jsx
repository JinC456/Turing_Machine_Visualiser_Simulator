import React, { useRef } from "react";
import "../Visualiser.css";
import Handles, { useAutoFontSize } from "./Handles";

export default function AcceptNode({ data = {} }) {
 const labelRef = useRef(null);
 useAutoFontSize(labelRef, data.label);
  
  return (
    <div className={`node accept ${data.isActive ? 'active' : ''}`}>
      <div className="inner-circle">
        {data?.label && (
          <div ref={labelRef} className="node-label">
            {data.label}
          </div>
        )}
      </div>
      <Handles showLeft={true}/>
      </div>
  );
}