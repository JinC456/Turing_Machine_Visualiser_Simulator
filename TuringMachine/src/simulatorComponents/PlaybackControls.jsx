import React from "react";

export default function PlaybackControls({
  onStepBack,
  onStepForward,
  onStart,
  onStop,
  onReset,
  isRunning,
  isFinished, 
  canUndo
}) {
  return (
    <div className="playback-controls">
      {/* Disable Step Back if running/finished */}
      <button onClick={onStepBack} disabled={isRunning || isFinished || !canUndo}>
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
    </div>
  );
}