import React from "react";
import PlaybackControls from "./PlaybackControls";
import TapeDisplay from "./TapeDisplay";

export default function TapeContainer() {
  return (
    <div className="tape-container">
      <div className="tape">
      </div>
    <TapeDisplay/>
    <PlaybackControls/>
    </div>
  );
}
