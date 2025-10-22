import React from "react";

export default function TapeContainer() {
  return (
    <div className="tape-container">
      <div className="tape">
        {/* Example 10 cells */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div className={`cell ${i === 5 ? "active" : ""}`} key={i}></div>
        ))}
      </div>

      {/* Controls */}
      <div className="controls">
        <button>Run</button>
        <button>Step</button>
        <button>Reset</button>
      </div>
    </div>
  );
}
