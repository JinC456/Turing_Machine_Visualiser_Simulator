import React, { useRef, useEffect } from "react";
import "../Visualiser.css";

export default function TapeDisplay({ tape, head }) {
  const cellWidth = 40;
  
  // Keep track of the previous head position to detect jumps
  const prevHead = useRef(head);

  // If the head moves by more than 1, it's likely a tape expansion or reset.
  // In this case, we want to snap instantly (no animation).
  const isJump = Math.abs(head - prevHead.current) > 1;

  // Update the ref after rendering
  useEffect(() => {
    prevHead.current = head;
  }, [head]);

  return (
    <> 
      <div className="tape-header">
        <div className="tape-pointer">
          <div className="tape-start-label">START</div>
          <div className="tape-arrow">▼</div>
        </div>
      </div>

      <div className="tape-wrapper">
        <div
          className="tape"
          style={{ 
            transform: `translateX(${-head * cellWidth}px)`,
            // Dynamically disable transition during jumps/expansions
            transition: isJump ? "none" : "transform 0.3s ease-in-out"
          }}
        >
          {tape.map((symbol, index) => (
            <div
              key={index}
              className={`cell ${index === head ? "active" : ""}`}
              style={{ width: `${cellWidth}px` }}
            >
              {symbol || ""}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}