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
  canUndo,
  isSkipping,
}) {
  return (
    <div className="playback-controls">
      <style>{`
        @keyframes pcb-soft-pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(66, 133, 244, 0.4);
          }
          70% {
            box-shadow: 0 0 0 6px rgba(66, 133, 244, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(66, 133, 244, 0);
          }
        }

        .pcb-skipping {
          background: #e8f0fe !important;
          color: #1a3c7c !important;
          border-color: #a8c7fa !important;
          cursor: wait !important;

          animation: pcb-soft-pulse 1.8s ease-out infinite;
          transition: all 0.25s ease;
        }
      `}</style>

      <button onClick={onSkipToStart} disabled={isRunning || isSkipping} title="Skip to Start">
        ◀◀
      </button>

      <button onClick={onStepBack} disabled={isRunning || isSkipping || !canUndo} title="Step Back">
        ◀
      </button>

      <button onClick={onStepForward} disabled={isRunning || isSkipping || isFinished} title="Step Forward">
        ▶
      </button>

      <button
        onClick={onSkipToEnd}
        disabled={isRunning || isFinished}
        title={isSkipping ? "Computing…" : "Skip to End"}
        className={isSkipping ? "pcb-skipping" : ""}
      >
        ▶▶
      </button>

      <button onClick={onStart} disabled={isRunning || isSkipping || isFinished} title="Auto Run">
        Start
      </button>

      <button onClick={onStop} disabled={!isRunning} title="Stop">
        Stop
      </button>

      <button onClick={onClear} disabled={isSkipping} title="Clear">
        Clear
      </button>
    </div>
  );
}