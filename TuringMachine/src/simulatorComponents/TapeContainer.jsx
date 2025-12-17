import React, { useState, useEffect } from "react";
import PlaybackControls from "./PlaybackControls";
import TapeDisplay from "./TapeDisplay";
import { useTuringMachine } from "./TuringMachineLogic"; 

export default function TapeContainer({ nodes, edges, activeNodeId, setActiveNodeId }) {
  const tm = useTuringMachine(13);

  // Sync active node up to parent
  useEffect(() => {
    setActiveNodeId(tm.activeNodeId);
  }, [tm.activeNodeId, setActiveNodeId]);

  const [isRunning, setIsRunning] = useState(false);
  const [inputValue, setInputValue] = useState("");

  // Determine if the machine is in a finished state (Accept or Error)
  const isFinished = !!(tm.error || tm.success);

  // Initialize Tape from Input
  useEffect(() => {
    if (isRunning || isFinished) return; // Don't update tape if running or finished
    
    const newTape = Array(13).fill(""); 
    const chars = inputValue.split("");
    const startPos = Math.floor(13 / 2);
    
    chars.forEach((char, i) => { 
      if (startPos + i < 13) {
        // Interpret * as empty string
        newTape[startPos + i] = char === "*" ? "" : char; 
      }
    });
    
    tm.setTape(newTape);
    tm.setHead(startPos);
  }, [inputValue, isRunning, isFinished]); 

  // Run Loop
  useEffect(() => {
    let interval;
    if (isRunning) {
      if (isFinished) {
        setIsRunning(false); // Stop the loop if finished
      } else {
        interval = setInterval(() => tm.stepForward(nodes, edges), 500);
      }
    }
    return () => clearInterval(interval);
  }, [isRunning, isFinished, tm.stepForward, nodes, edges]);

  return (
    <div className="tape-container">
      {tm.error && <div className="status-message error">Error: {tm.error}</div>}
      {tm.success && <div className="status-message success">Accepted!</div>}
      
      <TapeDisplay tape={tm.tape} head={tm.head} />

      <input
        className="tape-input"
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        disabled={isRunning || isFinished} // Lock input when finished
        placeholder="Input string... (use * for blank)"
      />

      <PlaybackControls
        onStepForward={() => tm.stepForward(nodes, edges)}
        onStepBack={tm.stepBack} 
        onStart={() => {
            // Only start if not currently finished. 
            // The user must press Reset to clear the finished state.
            if (!isFinished) setIsRunning(true);
        }}
        onStop={() => setIsRunning(false)}
        onReset={() => { 
            setIsRunning(false); 
            tm.reset(); 
            // We do NOT clear inputValue here so the user can rerun the same input easily
        }}
        isRunning={isRunning}
        isFinished={isFinished} // Pass down to lock buttons
        canUndo={tm.canUndo} 
      />
    </div>
  );
}