import React from "react";

export default function PlaybackControls({
  onStepBack,
  onStepForward,
  onStart,
  onStop,
  onSkipToStart,
  onSkipToEnd,
  onClear,
  isRunning,
  isFinished,
  canUndo
}) {
  return (
    <div className="playback-controls">
      <button onClick={onSkipToStart} disabled={isRunning} title="Skip to Start">
        ◀◀
      </button>

      <button onClick={onStepBack} disabled={isRunning || !canUndo} title="Step Back">
        ◀
      </button>

      <button onClick={onStepForward} disabled={isRunning || isFinished} title="Step Forward">
        ▶
      </button>

      <button onClick={onSkipToEnd} disabled={isRunning || isFinished} title="Skip to End">
        ▶▶
      </button>

      <button onClick={onStart} disabled={isRunning || isFinished} title="Auto Run">
        Start
      </button>

      <button onClick={onStop} disabled={!isRunning} title="Stop">
        Stop
      </button>

      <button onClick={onClear} title="Clear">
        Clear
      </button>
    </div>
  );
}