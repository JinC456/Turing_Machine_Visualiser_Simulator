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
  
  // Destructure tm to stabilize dependencies and prevent infinite re-renders
  const { 
    tape, head, activeNodeId: tmActiveNode, activeEdgeId: tmActiveEdge, 
    lastRead, stepCount: tmStepCount, error, success, 
    setTape, setHead, stepForward, stepBack, reset, canUndo 
  } = tm;

  const [isRunning, setIsRunning] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isTimeout, setIsTimeout] = useState(false);
  
  // Speed State: Steps per second
  const [speed, setSpeed] = useState(1); 

  const isFinished = !!(error || success || isTimeout);

  /* ---------- sync active node / symbol / step count ---------- */
  useEffect(() => {
    setActiveNodeId(tmActiveNode);
    setActiveEdgeId(tmActiveEdge);
    setCurrentSymbol(lastRead !== null ? lastRead : "");
    setStepCount(tmStepCount);
  }, [
    tmActiveNode,
    tmActiveEdge,
    lastRead,
    tmStepCount,
    setActiveNodeId,
    setActiveEdgeId,
    setCurrentSymbol,
    setStepCount
  ]);

  /* ---------- initialize tape (ONLY on reset) ---------- */
  const initializeTape = useCallback(() => {
    if (canUndo) return; 

    const cellWidth = 40; 
    const containerWidth = window.innerWidth * 0.9; 
    let dynamicCount = Math.ceil(containerWidth / cellWidth) + 200;
    if (dynamicCount % 2 === 0) dynamicCount++;
    const defaultSize = Math.max(13, dynamicCount);
    
    const startPos = Math.floor(defaultSize / 2);
    const chars = inputValue.split("");
    const requiredSize = Math.max(defaultSize, startPos + chars.length);
    const newTape = Array(requiredSize).fill("");

    chars.forEach((char, i) => {
      newTape[startPos + i] = char === "*" ? "" : char;
    });

    setTape(newTape);
    setHead(startPos);
  }, [inputValue, canUndo, setTape, setHead]);

  useEffect(() => {
    if (!isRunning && !isFinished && !canUndo) {
        initializeTape();
    }
  }, [inputValue, isRunning, isFinished, canUndo, initializeTape]);

  /* ---------- auto run ---------- */
  useEffect(() => {
    if (!isRunning) return;

    const intervalMs = 1000 / speed;

    const interval = setInterval(() => {
      // Check for Timeout (e.g., 100 steps)
      if (tmStepCount >= 100) {
        setIsRunning(false);
        setIsTimeout(true);
        return;
      }

      if (!error && !success) {
        stepForward(nodes, edges);
      } else {
        setIsRunning(false);
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isRunning, error, success, tmStepCount, stepForward, nodes, edges, speed]);

  /* ---------- active label ---------- */
  let activeLabel = ""; 
  if (tmActiveNode) {
    const node = nodes.find((n) => n.id === tmActiveNode);
    activeLabel = node?.data?.label || ""; 
  } else {
    const startNode = nodes.find((n) => n.type === "start");
    activeLabel = startNode?.data?.label || "START"; 
  }

  // --- Handle Clear ---
  const handleClear = () => {
    setIsRunning(false);
    setIsTimeout(false);
    setInputValue(""); 
    reset(); 
  };

  // --- Determine Status Message ---
  let statusMessage = null;
  let statusType = "";

  if (success) {
    statusType = "success";
    statusMessage = "Accepted";
  } else if (isTimeout) {
    statusType = "error"; 
    statusMessage = "Rejected: Time Out";
  } else if (error) {
    statusType = "error";
    if (error === "No transition defined") {
      statusMessage = "Rejected: Halted in non-accept state";
    } else {
      statusMessage = `Rejected: ${error}`;
    }
  }

  return (
    <div className="tape-container">
      
      {/* 1. Tape Display (Top) */}
      <TapeDisplay tape={tape} head={head} activeLabel={activeLabel} />

      {/* 2. Status Area (Absolute Positioned Overlay) */}
      <div className="status-area">
        {statusMessage && (
          <div className={`status-message ${statusType}`}>
            <span className="status-icon">{statusType === "success" ? "✅" : "❌"}</span>
            <div className="status-text">
              <strong>{statusMessage}</strong>
            </div>
          </div>
        )}
      </div>

      {/* 3. Controls (Bottom) */}
      <div className="controls-row">
        
        <input
          className="tape-input"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={isRunning || isFinished || canUndo}
          placeholder="Input string..."
        />

        <PlaybackControls
          onStepForward={() => {
            setIsRunning(false);
            if (!isTimeout) stepForward(nodes, edges);
          }}
          onStepBack={() => {
            setIsRunning(false);
            setIsTimeout(false);
            stepBack();
          }}
          onStart={() => {
            if (!isFinished) setIsRunning(true);
          }}
          onStop={() => setIsRunning(false)}
          onReset={() => {
            setIsRunning(false);
            setIsTimeout(false);
            reset();
          }}
          onClear={handleClear} 
          isRunning={isRunning}
          isFinished={isFinished}
          canUndo={canUndo}
        />

        <div className="speed-control">
          <label htmlFor="speed-slider">Speed: {speed}x</label>
          <input 
            id="speed-slider"
            type="range" 
            min="1" 
            max="3" 
            step="0.25"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          />
        </div>

      </div>
    </div>
  );
}