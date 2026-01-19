import React, { useRef, useEffect } from "react";
import "../Visualiser.css";

export default function TapeDisplay({ tape, head, activeLabel, cellSize = 40, width = "80vw" }) {
  const prevHead = useRef(head);
  const isJump = Math.abs(head - prevHead.current) > 1;

  useEffect(() => {
    prevHead.current = head;
  }, [head]);

  return (
    <> 
      <div className="tape-header">
        <div className="tape-pointer">
          <div className="tape-start-label">{activeLabel || "START"}</div>
          <div className="tape-arrow">▼</div>
        </div>
      </div>

      <div className="tape-wrapper" style={{ width: width }}>
        <div
          className="tape"
          style={{ 
            // Use props for dynamic sizing
            transform: `translateX(${-head * cellSize}px)`,
            transition: isJump ? "none" : "transform 0.3s ease-in-out"
          }}
        >
          {tape.map((symbol, index) => (
            <div
              key={index}
              className={`cell ${index === head ? "active" : ""}`}
              style={{ width: `${cellSize}px` }}
            >
              {symbol || ""}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}