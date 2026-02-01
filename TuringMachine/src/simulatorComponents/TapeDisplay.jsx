import React, { useRef, useEffect } from "react";
import "../Visualiser.css";

export default function TapeDisplay({ tape, head, activeLabel, cellSize = 40, width = "80vw" }) {
  const prevHead = useRef(head);
  const isJump = Math.abs(head - prevHead.current) > 1;

  useEffect(() => {
    prevHead.current = head;
  }, [head]);

  // If activeLabel is an empty string, we hide it. 
  // Otherwise default to "START" if null/undefined.
  const displayLabel = activeLabel === "" ? "" : (activeLabel || "START");

  return (
    // WRAPPER: Added position: relative so the absolute header aligns to THIS container
    <div style={{ position: 'relative', width: width, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      <div className="tape-header">
        <div className="tape-pointer">
          {displayLabel && <div className="tape-start-label">{displayLabel}</div>}
          <div className="tape-arrow">▼</div>
        </div>
      </div>

      <div className="tape-wrapper" style={{ width: "100%" }}>
        <div
          className="tape"
          style={{ 
            // Dynamic Sizing
            transform: `translateX(${-head * cellSize}px)`,
            transition: isJump ? "none" : "transform 0.3s ease-in-out",
            height: `${cellSize}px` 
          }}
        >
          {tape.map((symbol, index) => (
            <div
              key={index}
              className={`cell ${index === head ? "active" : ""}`}
              style={{ 
                width: `${cellSize}px`,
                height: `${cellSize}px`,
                fontSize: `${cellSize * 0.45}px`
              }}
            >
              {symbol || ""}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}