import React from "react";
import PlaybackControls from "./PlaybackControls";

export default function TapeContainer({ tape, head }) {
  return (
    <div className="tape-container">
      <div className="tape">
        {tape.map((symbol, index) => (
          <div key={index} className={`cell ${index === head ? "active" : ""}`}>
            {symbol}
          </div>
        ))}
      </div>
      <PlaybackControls />
    </div>
  );
}
