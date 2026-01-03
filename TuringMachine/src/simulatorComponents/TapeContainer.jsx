import React, { useState, useEffect } from "react";
import PlaybackControls from "./PlaybackControls";
import TapeDisplay from "./TapeDisplay";
import { useTuringMachine } from "./TuringMachineLogic"; 

export default function TapeContainer({ nodes, edges, activeNodeId, setActiveNodeId, setActiveEdgeId, setCurrentSymbol }) {
  const tm = useTuringMachine(13);

  useEffect(() => {
    setActiveNodeId(tm.activeNodeId);
    setActiveEdgeId(tm.activeEdgeId); 
    setCurrentSymbol(tm.tape[tm.head] || "");
  }, [tm.activeNodeId, tm.activeEdgeId, tm.tape, tm.head, setActiveNodeId, setActiveEdgeId, setCurrentSymbol]);
  
  
  const [isRunning, setIsRunning] = useState(false);
  const [inputValue, setInputValue] = useState("");


  const isFinished = !!(tm.error || tm.success);

  useEffect(() => {
    if (isRunning || isFinished) return; 
    
    const newTape = Array(13).fill(""); 
    const chars = inputValue.split("");
    const startPos = Math.floor(13 / 2);
    
    chars.forEach((char, i) => { 
      if (startPos + i < 13) {
        newTape[startPos + i] = char === "*" ? "" : char; 
      }
    });
    
    tm.setTape(newTape);
    tm.setHead(startPos);
  }, [inputValue, isRunning, isFinished]); 

  useEffect(() => {
    let interval;
    if (isRunning) {
      if (isFinished) {
        setIsRunning(false); 
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
        disabled={isRunning || isFinished}
        placeholder="Input string... (use * for blank)"
      />

      <PlaybackControls
        onStepForward={() => tm.stepForward(nodes, edges)}
        onStepBack={tm.stepBack} 
        onStart={() => {
            if (!isFinished) setIsRunning(true);
        }}
        onStop={() => setIsRunning(false)}
        onReset={() => { 
            setIsRunning(false); 
            tm.reset(); 
        }}
        isRunning={isRunning}
        isFinished={isFinished} 
        canUndo={tm.canUndo} 
      />
    </div>
  );
}