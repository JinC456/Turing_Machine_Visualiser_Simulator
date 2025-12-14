import React, { useState, useEffect } from "react";
import PlaybackControls from "./PlaybackControls";
import TapeDisplay from "./TapeDisplay";
import { turingMachine } from "./TuringMachineLogic"; 

export default function TapeContainer({ nodes, edges, activeNodeId, setActiveNodeId }) {
  const tm = turingMachine(13);

  useEffect(() => {
    setActiveNodeId(tm.activeNodeId);
  }, [tm.activeNodeId, setActiveNodeId]);

  const [isRunning, setIsRunning] = useState(false);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    if (isRunning) return;
    const newTape = Array(13).fill(""); 
    const chars = inputValue.split("");
    const startPos = Math.floor(13 / 2);
    chars.forEach((char, i) => { if (startPos + i < 13) newTape[startPos + i] = char; });
    
    tm.setTape(newTape);
    tm.setHead(startPos);
  }, [inputValue, isRunning]); 

  useEffect(() => {
    let interval;
    if (isRunning) {
      if (tm.error || tm.success) {
        setIsRunning(false);
        if (tm.error) alert(tm.error);
        if (tm.success) alert("Accepted!");
      } else {
        interval = setInterval(() => tm.stepForward(nodes, edges), 500);
      }
    }
    return () => clearInterval(interval);
  }, [isRunning, tm.error, tm.success, tm.stepForward, nodes, edges]);

  return (
    <div className="tape-container">
      <TapeDisplay tape={tm.tape} head={tm.head} />

      <input
        className="tape-input"
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        disabled={isRunning}
      />

      <PlaybackControls
        onStepForward={() => tm.stepForward(nodes, edges)}
        onStepBack={tm.stepBack} 
        onStart={() => setIsRunning(true)}
        onStop={() => setIsRunning(false)}
        onReset={() => { setIsRunning(false); tm.reset(); setInputValue(""); }}
        isRunning={isRunning}
        canUndo={tm.canUndo} 
      />
    </div>
  );
}