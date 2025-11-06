import React from 'react';

export default function PlaybackControls({ onMoveLeft, onMoveRight }) {
  return (
    <div className="playback-controls">
      <button onClick={onMoveLeft}>◀</button>
      <button onClick={onMoveRight}>▶</button>
      <button>Start</button>
      <button>Stop</button>
      <button>Reset</button>
    </div>
  );
}
