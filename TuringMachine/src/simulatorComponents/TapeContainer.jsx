/* src/simulatorComponents/TapeContainer.jsx */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import PlaybackControls from "./PlaybackControls";
import TapeDisplay from "./TapeDisplay";
import { useTuringMachine, useMultiTapeTuringMachine, useNonDeterministicTM } from "./TuringMachineLogic";
import { getNodeLabel } from "./engines/Deterministic";
import "../Visualiser.css"; 

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
  engine,
  isRunning,
  setIsRunning
}) {
  const isMultiTape = engine === "MultiTape";
  const isNonDeterministic = engine === "NonDeterministic";

  // --- View Options State ---
  const [showFrozen, setShowFrozen] = useState(false);
  const [showRejected, setShowRejected] = useState(false);

  // --- Determine Number of Tapes ---
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

  // --- Hooks ---
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

  // --- Local State ---
  const [inputValue, setInputValue] = useState(loadedInput || "");
  const [isTimeout, setIsTimeout] = useState(false);
  const [inputError, setInputError] = useState(null);
  const [speed, setSpeed] = useState(1); 
  const isFinished = !!(error || success || isTimeout);

  // --- Sync Input ---
  useEffect(() => {
    if (loadedInput !== undefined) { setInputValue(loadedInput); reset(); }
  }, [loadedInput, reset]);

  // --- Validate Input ---
  useEffect(() => {
    if (!inputValue) { setInputError(null); return; }
    const chars = inputValue.split("");
    const invalidChars = chars.filter(char => !validAlphabet.has(char));
    if (invalidChars.length > 0) setInputError(`Invalid: ${[...new Set(invalidChars)].join(", ")}`);
    else setInputError(null);
  }, [inputValue, validAlphabet]);

  // --- Sync Parent State ---
  useEffect(() => {
    if (isNonDeterministic) {
        setActiveNodeId(null);
        setActiveEdgeId(null);
        setCurrentSymbol(""); 
        setStepCount(tmStepCount);
    } else {
        setActiveNodeId(tm.activeNodeId);
        setActiveEdgeId(tm.activeEdgeId);
        const symbolToDisplay = isMultiTape && Array.isArray(tm.lastRead) ? tm.lastRead.join(",") : (tm.lastRead !== null ? tm.lastRead : "");
        setCurrentSymbol(symbolToDisplay);
        setStepCount(tmStepCount);
    }
  }, [tm.activeNodeId, tm.activeEdgeId, tm.lastRead, tmStepCount, setActiveNodeId, setActiveEdgeId, setCurrentSymbol, setStepCount, isMultiTape, isNonDeterministic]);

  // --- Initialize Tape ---
  const initializeTape = useCallback(() => {
    if (canUndo || inputError) return; 
    const defaultSize = 25; 
    const startPos = Math.floor(defaultSize / 2);
    const chars = inputValue.split("");
    const requiredSize = Math.max(defaultSize, startPos + chars.length);
    const tape1 = Array(requiredSize).fill("");
    chars.forEach((char, i) => { tape1[startPos + i] = char === "*" ? "" : char; });

    if (isNonDeterministic) setThreadNonDet(tape1, startPos); 
    else if (isMultiTape) {
        const newTapes = [tape1];
        for(let i=1; i<numTapes; i++) newTapes.push(Array(requiredSize).fill(""));
        setTapesMulti(newTapes);
        setHeadsMulti(Array(numTapes).fill(startPos));
    } else {
        setTapeSingle(tape1);
        setHeadSingle(startPos);
    }
  }, [inputValue, canUndo, inputError, isMultiTape, isNonDeterministic, numTapes, setThreadNonDet, setTapesMulti, setHeadsMulti, setTapeSingle, setHeadSingle]);

  useEffect(() => {
    if (!isRunning && !isFinished && !canUndo) initializeTape();
  }, [initializeTape, isRunning, isFinished, canUndo]);

  // --- Loop ---
  useEffect(() => {
    if (!isRunning) return;
    const intervalMs = 1000 / speed;
    const interval = setInterval(() => {
      if (tmStepCount >= 200) { setIsRunning(false); setIsTimeout(true); return; }
      
      if (isNonDeterministic) {
          if (tm.success) setIsRunning(false);
          else if (!tm.threads.some(t => t.status === 'active') && tmStepCount > 0) setIsRunning(false);
          else stepForward(nodes, edges);
      } else {
          if (!error && !success) stepForward(nodes, edges);
          else setIsRunning(false);
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
  
  // --- Status ---
  let statusMessage = null;
  let statusType = "";
  if (inputError) { statusType = "error"; statusMessage = inputError; }
  else if (success) { statusType = "success"; statusMessage = "Accepted"; }
  else if (isTimeout) { statusType = "error"; statusMessage = "Rejected: Time Out"; }
  else if (error) { statusType = "error"; statusMessage = `Rejected: ${error}`; }

  const alphabetString = validAlphabet.size > 0 ? [...validAlphabet].sort().join(", ") : "∅";

  // --- RENDER THREAD LIST ---
  const renderThreadList = () => {
    // 1. Filter
    const visibleThreads = tm.threads.filter(t => {
        if (t.status === 'active' || t.status === 'accepted') return true;
        if (t.status === 'frozen' && showFrozen) return true;
        if (t.status === 'rejected' && showRejected) return true;
        return false;
    });

    // 2. Fallback Logic (Zero State)
    let displayThreads = [...visibleThreads];
    
    // If no threads exist (e.g. after reset), ensure we show a dummy "Root" thread
    if (displayThreads.length === 0 && tmStepCount === 0) {
        const defaultSize = 25; 
        const startPos = Math.floor(defaultSize / 2);
        const chars = inputValue.split("");
        const requiredSize = Math.max(defaultSize, startPos + chars.length);
        const mockTape = Array(requiredSize).fill("");
        chars.forEach((char, i) => { mockTape[startPos + i] = char === "*" ? "" : char; });

        displayThreads.push({
            id: "1", // UPDATED: Default ID is "1"
            tape: mockTape,
            head: startPos,
            currentNodeId: null,
            status: "active",
            stepCount: 0
        });
    }

    // 3. Numeric Sort (So 1.10 comes after 1.2)
    const sortedThreads = displayThreads.sort((a, b) => 
      a.id.localeCompare(b.id, undefined, { numeric: true })
    );

    return (
      <div className="thread-list-wrapper" style={{ width: '90%' }}>
          {/* View Options Controls */}
          <div className="ntm-view-controls" style={{ 
              display: 'flex', 
              gap: '15px', 
              marginBottom: '10px', 
              fontSize: '0.9rem',
              color: '#555' 
          }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={showFrozen} 
                    onChange={(e) => setShowFrozen(e.target.checked)}
                    style={{ marginRight: '6px' }}
                  />
                  Show History (Frozen)
              </label>
              
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={showRejected} 
                    onChange={(e) => setShowRejected(e.target.checked)}
                    style={{ marginRight: '6px' }}
                  />
                  Show Rejected
              </label>
          </div>

          <div className="thread-list-container">
              {/* Only show "All rejected" if we actually stepped and filtered everything out */}
              {sortedThreads.length === 0 && tmStepCount > 0 && (
                  <div className="empty-threads">
                     All threads rejected (Hidden).
                  </div>
              )}
              
              {sortedThreads.map((thread) => {
                  const depth = thread.id.split('.').length - 1;
                  const indent = depth * 35; 
                  const hasConnector = depth > 0;

                  return (
                      <div 
                        key={thread.id} 
                        className="thread-tree-row"
                        style={{ marginLeft: `${indent}px` }}
                      >
                          {hasConnector && <div className="tree-connector"></div>}

                          <div className={`thread-card ${thread.status} tree-card`}>
                              <div className="thread-header">
                                  <div className="thread-id-info">
                                    {/* CHANGED: Show Full ID for clarity (e.g., 1.2.1) */}
                                    <span className="thread-name">
                                      Thread {thread.id}
                                    </span>
                                    <span className="thread-meta">
                                      {thread.status === 'frozen' 
                                        ? ` (Frozen at Step ${thread.stepCount})` 
                                        : ` (Step ${thread.stepCount})`
                                      }
                                    </span>
                                  </div>
                                  
                                  <span className={`thread-status-badge ${thread.status}`}>
                                    {thread.status === 'active' ? '● Run' : 
                                     thread.status === 'frozen' ? '⑂ Split' :
                                     thread.status === 'accepted' ? '✔ Accept' : '✖ Reject'}
                                  </span>
                              </div>
                              
                              <TapeDisplay 
                                  tape={thread.tape} 
                                  head={thread.head} 
                                  activeLabel={activeLabel(thread.currentNodeId)} 
                                  cellSize={30} 
                                  width="100%"
                              />
                          </div>
                      </div>
                  );
              })}
          </div>
      </div>
    );
  };

  return (
    <div className="tape-container">
      {isNonDeterministic ? renderThreadList() : (
        isMultiTape ? (
            <div className="multitape-container">
               {tm.tapes.map((tape, index) => (
                    <div key={index} className="multitape-row">
                        <div className="multitape-label">Tape {index + 1}</div>
                        <div className="tape-display-wrapper">
                            <TapeDisplay tape={tape} head={tm.heads[index]} activeLabel={activeLabel(tm.activeNodeId)} cellSize={CELL_SIZE} width="70vw" />
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="singletape-wrapper">
                <TapeDisplay tape={tm.tape} head={tm.head} activeLabel={activeLabel(tm.activeNodeId)} cellSize={CELL_SIZE} width="80vw" />
            </div>
        )
      )}

      <div className="status-area">
        {statusMessage && (
          <div className={`status-message ${statusType}`}>
            <span className="status-icon">{statusType === "success" ? "✅" : "❌"}</span>
            <strong>{statusMessage}</strong>
          </div>
        )}
      </div>

      <div className="controls-row">
        <div className="input-wrapper">
          <input className={`tape-input ${inputError ? "error" : ""}`} type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} disabled={isRunning || isFinished || canUndo} placeholder="Input string..." />
          <div className="alphabet-label">Σ: <span>{`{ ${alphabetString} }`}</span></div>
        </div>
        <PlaybackControls 
            onStepForward={() => { setIsRunning(false); if (!isTimeout) stepForward(nodes, edges); }}
            onStepBack={() => { setIsRunning(false); setIsTimeout(false); stepBack(); }}
            onStart={() => { if (!isFinished && !inputError) setIsRunning(true); }}
            onStop={() => setIsRunning(false)}
            onReset={() => { setIsRunning(false); setIsTimeout(false); reset(); }}
            onClear={handleClear} 
            isRunning={isRunning} isFinished={isFinished || !!inputError} canUndo={canUndo}
        />
        <div className="speed-control">
          <label>Speed: {speed}x</label>
          <input type="range" min="0.25" max="2" step="0.25" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
        </div>
      </div>
    </div>
  );
}