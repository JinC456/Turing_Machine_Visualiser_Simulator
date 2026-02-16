/* src/simulatorComponents/TapeDisplay.jsx */
import React, { useRef, useEffect } from "react";
import "../Visualiser.css";

export default function TapeDisplay({ tape, head, activeLabel, cellSize = 40, width = "80vw" }) {
  const prevHead = useRef(head);
  const wrapperRef = useRef(null); // 1. Create a ref for the wrapper
  const isJump = Math.abs(head - prevHead.current) > 1;

  useEffect(() => {
    prevHead.current = head;
  }, [head]);


  const displayLabel = activeLabel === "" ? "" : (activeLabel || "START");

  return (
    <div style={{ position: 'relative', width: width, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      <div className="tape-header">
        <div className="tape-pointer">
          {displayLabel && <div className="tape-start-label">{displayLabel}</div>}
          <div className="tape-arrow">▼</div>
        </div>
      </div>

      {/* 3. Attach the ref here */}
      <div 
        ref={wrapperRef} 
        className="tape-wrapper" 
        style={{ width: "100%" }}
      >
        <div
          className="tape"
          style={{ 
            left: `calc(50% - ${cellSize / 2}px)`,
            transform: `translateX(${-head * cellSize}px)`,
            transition: isJump ? "none" : "transform 0.3s ease-in-out",
            height: `${cellSize}px` 
          }}
        >
          {tape.map((symbol, index) => {
            const hasMarker = typeof symbol === 'string' && symbol.includes('^');
            const cleanSymbol = hasMarker ? symbol.replace('^', '') : symbol;

            return (
              <div
                key={index}
                className={`cell ${index === head ? "active" : ""}`}
                style={{ 
                  width: `${cellSize}px`,
                  height: `${cellSize}px`,
                  fontSize: `${cellSize * 0.45}px`
                }}
              >
                <div className="cell-content-wrapper">
                  {hasMarker && <span className="diacritic-marker">^</span>}
                  {cleanSymbol || ""}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}