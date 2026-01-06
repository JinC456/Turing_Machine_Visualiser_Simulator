import React, { useState, useEffect, useCallback } from "react";
import PlaybackControls from "./PlaybackControls";
import TapeDisplay from "./TapeDisplay";
import { useTuringMachine } from "./TuringMachineLogic";

export default function TapeContainer({
  nodes,
  edges,
  activeNodeId,
  setActiveNodeId,
  setActiveEdgeId,
  setCurrentSymbol,
  setStepCount
}) {
  const tm = useTuringMachine(13);

  const [isRunning, setIsRunning] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const isFinished = !!(tm.error || tm.success);

  /* ---------- sync active node / symbol / step count ---------- */
  useEffect(() => {
    setActiveNodeId(tm.activeNodeId);
    setActiveEdgeId(tm.activeEdgeId);
    
    // Use lastRead (the symbol that caused the transition) 
    setCurrentSymbol(tm.lastRead !== null ? tm.lastRead : "");
    
    // Sync step count to trigger animations
    setStepCount(tm.stepCount);
  }, [
    tm.activeNodeId,
    tm.activeEdgeId,
    tm.lastRead,
    tm.stepCount,
    setActiveNodeId,
    setActiveEdgeId,
    setCurrentSymbol,
    setStepCount
  ]);

  /* ---------- initialize tape (ONLY on reset) ---------- */
  const initializeTape = useCallback(() => {
    if (tm.canUndo) return; 

    const defaultSize = 13;
    const startPos = Math.floor(defaultSize / 2);
    const chars = inputValue.split("");

    const requiredSize = Math.max(defaultSize, startPos + chars.length);
    const newTape = Array(requiredSize).fill("");

    chars.forEach((char, i) => {
      newTape[startPos + i] = char === "*" ? "" : char;
    });

    tm.setTape(newTape);
    tm.setHead(startPos);
  }, [inputValue, tm]);

  useEffect(() => {
    if (!isRunning && !isFinished && !tm.canUndo) {
        initializeTape();
    }
  }, [inputValue, isRunning, isFinished, tm.canUndo, initializeTape]);

  /* ---------- auto run ---------- */
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      if (!tm.error && !tm.success) {
        tm.stepForward(nodes, edges);
      } else {
        setIsRunning(false);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isRunning, tm, nodes, edges]);

  /* ---------- active label ---------- */
  let activeLabel = ""; 
  if (tm.activeNodeId) {
    const node = nodes.find((n) => n.id === tm.activeNodeId);
    activeLabel = node?.data?.label || ""; 
  } else {
    const startNode = nodes.find((n) => n.type === "start");
    activeLabel = startNode?.data?.label || "START"; 
  }

  // --- NEW: Handle Clear ---
  const handleClear = () => {
    setIsRunning(false);
    setInputValue(""); // Clear input text
    tm.reset(); // Reset TM state
    // The useEffect dependent on inputValue will automatically clear the tape
  };

  return (
    <div className="tape-container">
      {tm.error && <div className="status-message error">Error: {tm.error}</div>}
      {tm.success && <div className="status-message success">Accepted!</div>}

      <TapeDisplay tape={tm.tape} head={tm.head} activeLabel={activeLabel} />

      <input
        className="tape-input"
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        disabled={isRunning || isFinished || tm.canUndo}
        placeholder="Input string... (use * for blank)"
      />

      <PlaybackControls
        onStepForward={() => {
          setIsRunning(false);
          tm.stepForward(nodes, edges);
        }}
        onStepBack={() => {
          setIsRunning(false);
          tm.stepBack();
        }}
        onStart={() => {
          if (!isFinished) setIsRunning(true);
        }}
        onStop={() => setIsRunning(false)}
        onReset={() => {
          setIsRunning(false);
          tm.reset();
        }}
        onClear={handleClear} // Pass the handler
        isRunning={isRunning}
        isFinished={isFinished}
        canUndo={tm.canUndo}
      />
    </div>
  );
}