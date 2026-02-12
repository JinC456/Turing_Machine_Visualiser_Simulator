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

  // 2. DEBUGGING LOGS
  useEffect(() => {
    if (wrapperRef.current) {
      const el = wrapperRef.current;
      console.log(`[TapeDebug] Step:`, {
        tapeLength: tape.length,
        cellSize,
        wrapperWidth: el.offsetWidth,   // How wide the box IS on screen
        contentWidth: el.scrollWidth,   // How wide the content WANTS to be
        isOverflowing: el.scrollWidth > el.offsetWidth, // Should be TRUE for large tapes
        headPosition: head,
        calculatedLeft: `calc(50% - ${cellSize / 2}px)`
      });

      // Visual Check in Console
      if (el.offsetWidth > 2000) {
        console.error("⚠️ CRITICAL: The wrapper has exploded in width! Flexbox is not constraining it.");
      }
    }
  }, [tape, head, cellSize]);

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