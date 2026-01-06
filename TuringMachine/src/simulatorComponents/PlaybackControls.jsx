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
      {/* UPDATE: Removed '|| isFinished' so you can step back after acceptance/error */}
      <button onClick={onStepBack} disabled={isRunning || !canUndo}>
        ◀
      </button>

      {/* Disable Step Forward if running/finished */}
      <button onClick={onStepForward} disabled={isRunning || isFinished}>
        ▶
      </button>

      {/* Disable Start if running/finished */}
      <button onClick={onStart} disabled={isRunning || isFinished}>
        Start
      </button>

      <button onClick={onStop} disabled={!isRunning}>
        Stop
      </button>

      <button onClick={onReset}>
        Reset
      </button>

      <button onClick={onClear}>
        Clear
      </button>
    </div>
  );
}