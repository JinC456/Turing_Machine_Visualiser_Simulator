import React from "react";

export default function PlaybackControls({
  onStepBack,
  onStepForward,
  onStart,
  onStop,
  onReset,
  isRunning
}) {
  return (
    <div className="playback-controls">
      <button onClick={onStepBack} disabled={isRunning}>
        ◀
      </button>

      <button onClick={onStepForward} disabled={isRunning}>
        ▶
      </button>

      <button onClick={onStart} disabled={isRunning}>
        Start
      </button>

      <button onClick={onStop} disabled={!isRunning}>
        Stop
      </button>

      <button onClick={onReset}>
        Reset
      </button>
    </div>
  );
}
