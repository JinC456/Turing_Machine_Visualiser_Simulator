import React from "react";

export default function PlaybackControls({
  onStepBack,
  onStepForward,
  onStart,
  onStop,
  onReset,
  onClear,
  isRunning,
  isFinished, 
  canUndo
}) {
  return (
    <div className="playback-controls">
      <button onClick={onStepBack} disabled={isRunning || !canUndo}>
        ◀
      </button>

      <button onClick={onStepForward} disabled={isRunning || isFinished}>
        ▶
      </button>

      <button onClick={onStart} disabled={isRunning || isFinished}>
        Start
      </button>

      <button onClick={onStop} disabled={!isRunning}>
        Stop
      </button>

      <button onClick={onReset}>
        Restart
      </button>

      <button onClick={onClear}>
        Clear
      </button>
    </div>
  );
}