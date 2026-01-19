import React, { useState, useEffect, useCallback } from "react";
import PlaybackControls from "./PlaybackControls";
import TapeDisplay from "./TapeDisplay";
import { useTuringMachine, useMultiTapeTuringMachine } from "./TuringMachineLogic";
import { getNodeLabel } from "./engines/Deterministic";

// Define constant here to avoid magic numbers
const CELL_SIZE = 40;

export default function TapeContainer({
  nodes,
  edges,
  activeNodeId,
  setActiveNodeId,
  setActiveEdgeId,
  setCurrentSymbol,
  setStepCount,
  loadedInput,
  validAlphabet,
  engine
}) {
  const isMultiTape = engine === "MultiTape";

  const singleTM = useTuringMachine(13);
  const multiTM = useMultiTapeTuringMachine(13, 2);

  const tm = isMultiTape ? multiTM : singleTM;
  
  const { 
    activeNodeId: tmActiveNode, activeEdgeId: tmActiveEdge, 
    lastRead, stepCount: tmStepCount, error, success, 
    stepForward, stepBack, reset, canUndo 
  } = tm;

  const [isRunning, setIsRunning] = useState(false);
  const [inputValue, setInputValue] = useState(loadedInput || "");
  const [isTimeout, setIsTimeout] = useState(false);
  
  const [inputError, setInputError] = useState(null);

  const [speed, setSpeed] = useState(1); 

  const isFinished = !!(error || success || isTimeout);

  useEffect(() => {
    if (loadedInput !== undefined) {
      setInputValue(loadedInput);
    }
  }, [loadedInput]);

  useEffect(() => {
    if (!inputValue) {
      setInputError(null);
      return;
    }

    const chars = inputValue.split("");
    const invalidChars = chars.filter(char => !validAlphabet.has(char));

    if (invalidChars.length > 0) {
      const uniqueInvalid = [...new Set(invalidChars)].join(", ");
      setInputError(`Invalid symbol(s): ${uniqueInvalid}`);
    } else {
      setInputError(null);
    }
  }, [inputValue, validAlphabet]);

  useEffect(() => {
    setActiveNodeId(tmActiveNode);
    setActiveEdgeId(tmActiveEdge);
    
    // For display in diagram container
    const symbolToDisplay = isMultiTape && Array.isArray(lastRead) 
        ? lastRead.join(",") 
        : (lastRead !== null ? lastRead : "");

    setCurrentSymbol(symbolToDisplay);
    setStepCount(tmStepCount);
  }, [
    tmActiveNode,
    tmActiveEdge,
    lastRead,
    tmStepCount,
    setActiveNodeId,
    setActiveEdgeId,
    setCurrentSymbol,
    setStepCount,
    isMultiTape
  ]);

  const initializeTape = useCallback(() => {
    if (canUndo || inputError) return; 

    const containerWidth = window.innerWidth * 0.9; 
    // Use CELL_SIZE constant
    let dynamicCount = Math.ceil(containerWidth / CELL_SIZE) + 200;
    if (dynamicCount % 2 === 0) dynamicCount++;
    const defaultSize = Math.max(13, dynamicCount);
    
    const startPos = Math.floor(defaultSize / 2);
    const chars = inputValue.split("");
    const requiredSize = Math.max(defaultSize, startPos + chars.length);
    
    // Prepare tape 1 with input
    const tape1 = Array(requiredSize).fill("");
    chars.forEach((char, i) => {
      tape1[startPos + i] = char === "*" ? "" : char;
    });

    if (isMultiTape) {
        // Tape 2 is empty initially
        const tape2 = Array(requiredSize).fill("");
        tm.setTapes([tape1, tape2]);
        tm.setHeads([startPos, startPos]);
    } else {
        tm.setTape(tape1);
        tm.setHead(startPos);
    }

  }, [inputValue, canUndo, tm, inputError, isMultiTape]);

  useEffect(() => {
    if (!isRunning && !isFinished && !canUndo) {
        initializeTape();
    }
  }, [inputValue, isRunning, isFinished, canUndo, initializeTape]);

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

  /* ---------- active label using shared utility ---------- */
  let activeLabel = ""; 
  if (tmActiveNode) {
    const node = nodes.find((n) => n.id === tmActiveNode);
    activeLabel = getNodeLabel(node); 
  } else {
    const startNode = nodes.find((n) => n.type === "start");
    activeLabel = getNodeLabel(startNode) || "START"; 
  }

  const handleClear = () => {
    setIsRunning(false);
    setIsTimeout(false);
    setInputValue(""); 
    reset(); 
  };

  let statusMessage = null;
  let statusType = "";

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

  const alphabetString = validAlphabet.size > 0 
    ? [...validAlphabet].sort().join(", ") 
    : "∅";

  return (
    <div className="tape-container">
      
      {isMultiTape ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', width: '100%', alignItems: 'center' }}>
            
            {/* Tape 1 */}
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '90%' }}>
                <div style={{ 
                    fontWeight: 'bold', 
                    fontSize: '1.1rem', 
                    minWidth: '80px', 
                    textAlign: 'right', 
                    marginRight: '15px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                }}>
                    Tape 1
                </div>
                {/* Wrap in relative div so pointer (absolute) anchors here */}
                <div style={{ position: 'relative', flexGrow: 1 }}>
                    <TapeDisplay 
                        tape={tm.tapes[0]} 
                        head={tm.heads[0]} 
                        activeLabel={activeLabel} 
                        cellSize={CELL_SIZE} 
                        width="70vw"
                    />
                </div>
            </div>

            {/* Tape 2 */}
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '90%' }}>
                <div style={{ 
                    fontWeight: 'bold', 
                    fontSize: '1.1rem', 
                    minWidth: '80px', 
                    textAlign: 'right', 
                    marginRight: '15px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                }}>
                    Tape 2
                </div>
                {/* Wrap in relative div so pointer (absolute) anchors here */}
                <div style={{ position: 'relative', flexGrow: 1 }}>
                    <TapeDisplay 
                        tape={tm.tapes[1]} 
                        head={tm.heads[1]} 
                        activeLabel={activeLabel} 
                        cellSize={CELL_SIZE} 
                        width="70vw"
                    />
                </div>
            </div>
        </div>
      ) : (
        /* Single Tape - Wrap in relative to ensure pointer context is consistent */
        <div style={{ position: 'relative' }}>
            <TapeDisplay 
                tape={tm.tape} 
                head={tm.head} 
                activeLabel={activeLabel} 
                cellSize={CELL_SIZE} 
                width="80vw"
            />
        </div>
      )}

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
            Σ: <span>{`{ ${alphabetString} }`}</span>
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