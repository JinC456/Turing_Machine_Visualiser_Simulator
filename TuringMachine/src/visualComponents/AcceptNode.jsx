import React, { useRef, useLayoutEffect } from "react";
import "../Visualiser.css";
import Handles from "./Handles";

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
    // Add conditional "active" class here
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

