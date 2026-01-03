import React, { useRef, useLayoutEffect } from "react";
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
    // Add conditional "active" class here
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

