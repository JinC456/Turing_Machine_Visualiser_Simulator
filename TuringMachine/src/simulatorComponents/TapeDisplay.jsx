/* Updated TapeDisplay.js */
import React from "react";
import "../Visualiser.css";

export default function TapeDisplay({ tape, head }) {
  const cellWidth = 40;

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
          style={{ transform: `translateX(${-head * cellWidth}px)` }}
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