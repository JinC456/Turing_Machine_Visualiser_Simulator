import React, { useState, useEffect } from "react";
import PlaybackControls from "./PlaybackControls";
import TapeDisplay from "./TapeDisplay";
import "../Visualiser.css";

export default function TapeContainer() {
  const initialCells = 13; // odd number for centering head
  const initialHead = Math.floor(initialCells / 2);

  const [tape, setTape] = useState(Array(initialCells).fill(""));
  const [head, setHead] = useState(initialHead);

  const expansionSize = 6; // add 6 cells each time
  const edgeThreshold = 6; // expand when head enters first or last 6 cells

  // Expand tape dynamically when head gets near either edge
  useEffect(() => {
    let newTape = [...tape];
    let newHead = head;
    let expanded = false;

    if (head < edgeThreshold) {
      newTape = Array(expansionSize).fill("").concat(newTape);
      newHead = head + expansionSize; // shift head to stay on same symbol
      expanded = true;
    }

    if (head >= newTape.length - edgeThreshold) {
      newTape = [...newTape, ...Array(expansionSize).fill("")];
      expanded = true;
    }

    if (expanded) {
      setTape(newTape);
      setHead(newHead);
    }
  }, [head, tape]);

  const moveLeft = () => setHead((h) => h - 1);
  const moveRight = () => setHead((h) => h + 1);

  return (
    <div className="tape-container">
      {/* Tape display */}
      <TapeDisplay tape={tape} head={head} />

      {/* Playback controls */}
      <PlaybackControls onMoveLeft={moveLeft} onMoveRight={moveRight} />
    </div>
  );
}
