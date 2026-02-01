import React, { useState, useEffect, useCallback, useMemo } from "react";
import PlaybackControls from "./PlaybackControls";
import TapeDisplay from "./TapeDisplay";
import { useTuringMachine, useMultiTapeTuringMachine, useNonDeterministicTM } from "./TuringMachineLogic";
import { getNodeLabel } from "./engines/Deterministic";

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
  const isNonDeterministic = engine === "NonDeterministic";

  const numTapes = useMemo(() => {
    if (!isMultiTape) return 1;
    let max = 2;
    edges.forEach(edge => {
        edge.data?.labels?.forEach(label => {
            Object.keys(label).forEach(key => {
                if (key.startsWith('tape')) {
                    const n = parseInt(key.replace('tape', ''), 10);
                    if (!isNaN(n)) max = Math.max(max, n);
                }
            });
        });
    });
    return max;
  }, [edges, isMultiTape]);

  const singleTM = useTuringMachine(13);
  const multiTM = useMultiTapeTuringMachine(13, numTapes);
  const nonDetTM = useNonDeterministicTM(13);

  let tm;
  if (isNonDeterministic) tm = nonDetTM;
  else if (isMultiTape) tm = multiTM;
  else tm = singleTM;
  
  const { 
    error, success, stepForward, stepBack, reset, canUndo, stepCount: tmStepCount 
  } = tm;

  const { setTape: setTapeSingle, setHead: setHeadSingle } = singleTM;
  const { setTapes: setTapesMulti, setHeads: setHeadsMulti } = multiTM;
  const { setInitialThread: setThreadNonDet } = nonDetTM;

  const [isRunning, setIsRunning] = useState(false);
  const [inputValue, setInputValue] = useState(loadedInput || "");
  const [isTimeout, setIsTimeout] = useState(false);
  const [inputError, setInputError] = useState(null);
  const [speed, setSpeed] = useState(1); 

  const isFinished = !!(error || success || isTimeout);

  useEffect(() => {
    if (loadedInput !== undefined) {
      setInputValue(loadedInput);
      reset(); 
    }
  }, [loadedInput, reset]);

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
    if (isNonDeterministic) {
        setActiveNodeId(null);
        setActiveEdgeId(null);
        setCurrentSymbol(""); 
        setStepCount(tmStepCount);
    } else {
        setActiveNodeId(tm.activeNodeId);
        setActiveEdgeId(tm.activeEdgeId);
        
        const symbolToDisplay = isMultiTape && Array.isArray(tm.lastRead) 
            ? tm.lastRead.join(",") 
            : (tm.lastRead !== null ? tm.lastRead : "");

        setCurrentSymbol(symbolToDisplay);
        setStepCount(tmStepCount);
    }
  }, [
    tm.activeNodeId, tm.activeEdgeId, tm.lastRead, tmStepCount, tm.threads,
    setActiveNodeId, setActiveEdgeId, setCurrentSymbol, setStepCount, isMultiTape, isNonDeterministic
  ]);

  const initializeTape = useCallback(() => {
    if (canUndo || inputError) return; 

    const containerWidth = window.innerWidth * 0.9; 
    let dynamicCount = Math.ceil(containerWidth / CELL_SIZE) + 200;
    if (dynamicCount % 2 === 0) dynamicCount++;
    const defaultSize = Math.max(13, dynamicCount);
    
    const startPos = Math.floor(defaultSize / 2);
    const chars = inputValue.split("");
    const requiredSize = Math.max(defaultSize, startPos + chars.length);
    
    const tape1 = Array(requiredSize).fill("");
    chars.forEach((char, i) => {
      tape1[startPos + i] = char === "*" ? "" : char;
    });

    if (isNonDeterministic) {
        setThreadNonDet(tape1, startPos);
    } else if (isMultiTape) {
        const newTapes = [];
        newTapes.push(tape1);
        for(let i=1; i<numTapes; i++) {
            newTapes.push(Array(requiredSize).fill(""));
        }
        setTapesMulti(newTapes);
        setHeadsMulti(Array(numTapes).fill(startPos));
    } else {
        setTapeSingle(tape1);
        setHeadSingle(startPos);
    }

  }, [
    inputValue, canUndo, inputError, isMultiTape, isNonDeterministic, numTapes,
    setThreadNonDet, setTapesMulti, setHeadsMulti, setTapeSingle, setHeadSingle
  ]);

  useEffect(() => {
    if (!isRunning && !isFinished && !canUndo) {
        initializeTape();
    }
  }, [initializeTape, isRunning, isFinished, canUndo]);

  useEffect(() => {
    if (!isRunning) return;

    const intervalMs = 1000 / speed;

    const interval = setInterval(() => {
      if (tmStepCount >= 200) { 
        setIsRunning(false);
        setIsTimeout(true);
        return;
      }
      
      if (isNonDeterministic) {
          if (tm.success) {
              setIsRunning(false);
          } else if (tm.threads.length === 0 && tmStepCount > 0) {
              setIsRunning(false);
          } else {
              stepForward(nodes, edges);
          }
      } else {
          if (!error && !success) {
            stepForward(nodes, edges);
          } else {
            setIsRunning(false);
          }
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isRunning, error, success, tmStepCount, stepForward, nodes, edges, speed, isNonDeterministic, tm.threads, tm.success]);

  const activeLabel = (id) => {
      if (!id) return "START";
      const n = nodes.find(x => x.id === id);
      return getNodeLabel(n) || "S?";
  };

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
  } else if (isNonDeterministic) {
      if (tmStepCount > 0 && tm.threads.length === 0) {
          statusType = "error";
          statusMessage = "Rejected: All threads died";
      }
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
    
  const renderThreadList = () => (
      <div className="thread-list-container">
          {tm.threads.length === 0 && !success && tmStepCount > 0 && (
              <div className="empty-threads">All threads rejected.</div>
          )}
          {tm.threads.map((thread) => (
              <div key={thread.id} className={`thread-card ${thread.status}`}>
                  <div className="thread-header">
                      {/* Removed "State: ..." from here */}
                      <span style={{fontWeight: 'bold', color: '#888'}}>Thread</span>
                      <span className={`thread-status-badge ${thread.status}`}>
                        {thread.status === 'active' ? '● Running' : 
                         thread.status === 'accepted' ? '✔ Accept' : '✖ Reject'}
                      </span>
                  </div>
                  {/* Added activeLabel here so it appears on the pointer */}
                  <TapeDisplay 
                      tape={thread.tape} 
                      head={thread.head} 
                      activeLabel={activeLabel(thread.currentNodeId)} 
                      cellSize={CELL_SIZE}
                      width="60vw"
                  />
              </div>
          ))}
      </div>
  );

  return (
    <div className="tape-container">
      
      {isNonDeterministic ? renderThreadList() : (
        isMultiTape ? (
            <div className="multitape-container">
                {tm.tapes.map((tape, index) => (
                    <div key={index} className="multitape-row">
                        <div className="multitape-label">
                            Tape {index + 1}
                        </div>
                        <div className="tape-display-wrapper">
                            <TapeDisplay 
                                tape={tape} 
                                head={tm.heads[index]} 
                                activeLabel={activeLabel(tm.activeNodeId)} 
                                cellSize={CELL_SIZE} 
                                width="70vw"
                            />
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="singletape-wrapper">
                <TapeDisplay 
                    tape={tm.tape} 
                    head={tm.head} 
                    activeLabel={activeLabel(tm.activeNodeId)} 
                    cellSize={CELL_SIZE} 
                    width="80vw"
                />
            </div>
        )
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
            className={`tape-input ${inputError ? "error" : ""}`}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isRunning || isFinished || canUndo}
            placeholder="Input string..."
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