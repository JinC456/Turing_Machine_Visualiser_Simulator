import React from 'react';
import TapeDisplay from './TapeDisplay';
import PlaybackControls from './PlaybackControls';

export default function TapeContainer({ tape, head }) {
  return (
    <div className="tape-container">
      <p>This is the tape container</p>
      <TapeDisplay tape={tape} head={head} />
      <PlaybackControls />
    </div>
  );
}
