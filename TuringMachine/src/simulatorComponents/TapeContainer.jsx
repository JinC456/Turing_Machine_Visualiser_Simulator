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
  setStepCount,
  loadedInput,
  validAlphabet // 1. Receive the prop
}) {
  const tm = useTuringMachine(13);
  
  const { 
    tape, head, activeNodeId: tmActiveNode, activeEdgeId: tmActiveEdge, 
    lastRead, stepCount: tmStepCount, error, success, 
    setTape, setHead, stepForward, stepBack, reset, canUndo 
  } = tm;

  const [isRunning, setIsRunning] = useState(false);
  const [inputValue, setInputValue] = useState(loadedInput || "");
  const [isTimeout, setIsTimeout] = useState(false);
  
  // 2. State for Input Validation Error
  const [inputError, setInputError] = useState(null);

  const [speed, setSpeed] = useState(1); 

  const isFinished = !!(error || success || isTimeout);

  useEffect(() => {
    if (loadedInput !== undefined) {
      setInputValue(loadedInput);
    }
  }, [loadedInput]);

  // 3. Validation Logic
  useEffect(() => {
    if (!inputValue) {
      setInputError(null);
      return;
    }

    const chars = inputValue.split("");
    // Find characters not in the validAlphabet set
    const invalidChars = chars.filter(char => !validAlphabet.has(char));

    if (invalidChars.length > 0) {
      const uniqueInvalid = [...new Set(invalidChars)].join(", ");
      setInputError(`Invalid symbol(s): ${uniqueInvalid}`);
    } else {
      setInputError(null);
    }
  }, [inputValue, validAlphabet]);


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
    if (canUndo || inputError) return; // Prevent init if error exists

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
  }, [inputValue, canUndo, setTape, setHead, inputError]);

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

  const handleClear = () => {
    setIsRunning(false);
    setIsTimeout(false);
    setInputValue(""); 
    reset(); 
  };

  // --- Determine Status Message ---
  let statusMessage = null;
  let statusType = "";

  // 4. Input Error takes precedence in display (before running)
  if (inputError) {
    statusType = "error";
    statusMessage = inputError;
  } else if (success) {
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

  // Helper to format alphabet for display
  const alphabetString = validAlphabet.size > 0 
    ? [...validAlphabet].sort().join(", ") 
    : "∅";

  return (
    <div className="tape-container">
      
      <TapeDisplay tape={tape} head={head} activeLabel={activeLabel} />

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

      <div className="controls-row">
        
        {/* UPDATED: Alphabet Label is now BELOW the input */}
        <div className="input-wrapper">
          <input
            className="tape-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isRunning || isFinished || canUndo}
            placeholder="Input string..."
            style={inputError ? { borderColor: '#d9534f', backgroundColor: '#fdf7f7' } : {}}
          />
          <div className="alphabet-label">
            Alphabet: <span>{`{ ${alphabetString} }`}</span>
          </div>
        </div>

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
            if (!isFinished && !inputError) setIsRunning(true);
          }}
          onStop={() => setIsRunning(false)}
          onReset={() => {
            setIsRunning(false);
            setIsTimeout(false);
            reset();
          }}
          onClear={handleClear} 
          isRunning={isRunning}
          // 5. Disable running if input is invalid
          isFinished={isFinished || !!inputError} 
          canUndo={canUndo}
        />

        <div className="speed-control">
          <label htmlFor="speed-slider">Speed: {speed}x</label>
          <input 
            id="speed-slider"
            type="range" 
            min="0.25" 
            max="2" 
            step="0.25"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          />
        </div>

      </div>
    </div>
  );
}