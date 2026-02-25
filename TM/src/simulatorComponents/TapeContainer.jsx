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
  setNodes,
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
                    if (!isNaN(n)) max = Math.max(n, max);
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

  useEffect(() => {
    if (nodes && setNodes && !isRunning) {
        const startNode = nodes.find(n => n.type === 'start');
        if (startNode && startNode.data.input !== inputValue) {
            setNodes(nds => nds.map(n => 
            n.type === 'start' ? { ...n, data: { ...n.data, input: inputValue } } : n
            ));
        }
    }
  }, [inputValue, nodes, setNodes, isRunning]);

  // --- Sync Parent State ---
  useEffect(() => {
    if (isNonDeterministic) {
        setActiveNodeId(tm.threads); 
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
  }, [tm.activeNodeId, tm.threads, tm.activeEdgeId, tm.lastRead, tmStepCount, setActiveNodeId, setActiveEdgeId, setCurrentSymbol, setStepCount, isMultiTape, isNonDeterministic]);

  // --- Initialize Tape ---
  const initializeTape = useCallback(() => {
    if (inputError) return; 
    const defaultSize = 50; 
    const startPos = Math.floor(defaultSize / 2);
    const chars = inputValue.split("");
    const requiredSize = Math.max(defaultSize, startPos + chars.length);
    
    // USE ␣ INSTEAD OF ""
    const tape1 = Array(requiredSize).fill("␣");
    // DO NOT STRIP ␣ OUT ANYMORE
    chars.forEach((char, i) => { tape1[startPos + i] = char; });

    if (isNonDeterministic) setThreadNonDet(tape1, startPos); 
    else if (isMultiTape) {
        const newTapes = [tape1];
        // USE ␣ INSTEAD OF ""
        for(let i=1; i<numTapes; i++) newTapes.push(Array(requiredSize).fill("␣"));
        setTapesMulti(newTapes);
        setHeadsMulti(Array(numTapes).fill(startPos));
    } else {
        setTapeSingle(tape1);
        setHeadSingle(startPos);
    }
  }, [inputValue, inputError, isMultiTape, isNonDeterministic, numTapes, setThreadNonDet, setTapesMulti, setHeadsMulti, setTapeSingle, setHeadSingle]);
  
  // --- REAL-TIME SYNC ---
  useEffect(() => {
    if (!canUndo && tmStepCount === 0) {
      initializeTape();
    }
  }, [inputValue, initializeTape, canUndo, tmStepCount]);

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

  const handleRestart = () => {
    setIsRunning(false);
    setIsTimeout(false);
    reset();
    setTimeout(initializeTape, 0); 
  };

  const handleClear = () => {
    setIsRunning(false);
    setIsTimeout(false);
    setInputValue(""); 
    reset(); 
    const emptyTape = Array(50).fill("␣");
    const startPos = 25;
    if (isNonDeterministic) setThreadNonDet(emptyTape, startPos);
    else if (isMultiTape) {
      setTapesMulti(Array.from({length: numTapes}, () => [...emptyTape]));
      setHeadsMulti(Array(numTapes).fill(startPos));
    } else {
      setTapeSingle(emptyTape);
      setHeadSingle(startPos);
    }
  };
  
  // Rejection logic for clickable badge
  const showRejectReason = () => {
    if (isTimeout) alert("Rejected: Execution timed out (Max steps reached).");
    else if (error) alert(`Rejected: ${error}`);
    else alert("Rejected: Machine halted in a non-accepting state.");
  };

  const alphabetString = validAlphabet.size > 0 ? [...validAlphabet].sort().join(", ") : "";

  // --- DETERMINISTIC / MULTI-TAPE CARD RENDER ---
  const renderStandardCard = () => {
    let cardStatusClass = 'active';
    let statusBadgeText = 'Ready';

    if (success) {
        cardStatusClass = 'accepted';
        statusBadgeText = '✔ Accepted';
    } else if (error || isTimeout) {
        cardStatusClass = 'rejected';
        statusBadgeText = '✖ Rejected';
    } else if (isRunning) {
        cardStatusClass = 'active';
        statusBadgeText = '● Running';
    }

    return (
        <div className="thread-list-container" style={{ width: '90%', border: 'none', gap: '20px' }}>
            {isMultiTape ? tm.tapes.map((tape, index) => (
                <div key={index} className="thread-tree-row" style={{ width: '100%' }}>
                    <div className={`thread-card ${cardStatusClass} tree-card`} style={{ width: '100%', marginTop: '0px' }}>
                        <div className="thread-header">
                            <div className="thread-id-info">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '14px', height: '14px', borderRadius: '3px', backgroundColor: '#e8d71a', border: '1px solid rgba(0,0,0,0.1)' }} />
                                    <span className="thread-name">Tape {index + 1}</span>
                                </div>
                                <span className="thread-meta">(Step {tmStepCount})</span>
                            </div>
                            <span 
                                className={`thread-status-badge ${cardStatusClass}`}
                                style={{ cursor: cardStatusClass === 'rejected' ? 'pointer' : 'default' }}
                                onClick={() => cardStatusClass === 'rejected' && showRejectReason()}
                                title={cardStatusClass === 'rejected' ? "Click for reason" : ""}
                            >
                                {statusBadgeText}
                            </span>
                        </div>
                        <TapeDisplay tape={tape} head={tm.heads[index]} activeLabel={activeLabel(tm.activeNodeId)} cellSize={CELL_SIZE} width="100%" />
                    </div>
                </div>
            )) : (
                <div className="thread-tree-row" style={{ width: '100%' }}>
                    <div className={`thread-card ${cardStatusClass} tree-card`} style={{ width: '100%', marginTop: '0' }}>
                        <div className="thread-header">
                            <div className="thread-id-info">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '14px', height: '14px', borderRadius: '3px', backgroundColor: '#e8d71a', border: '1px solid rgba(0,0,0,0.1)' }} />
                                    <span className="thread-name">Tape</span>
                                </div>
                                <span className="thread-meta">(Step {tmStepCount})</span>
                            </div>
                            <span 
                                className={`thread-status-badge ${cardStatusClass}`}
                                style={{ cursor: cardStatusClass === 'rejected' ? 'pointer' : 'default' }}
                                onClick={() => cardStatusClass === 'rejected' && showRejectReason()}
                                title={cardStatusClass === 'rejected' ? "Click for reason" : ""}
                            >
                                {statusBadgeText}
                            </span>
                        </div>
                        <TapeDisplay tape={tm.tape} head={tm.head} activeLabel={activeLabel(tm.activeNodeId)} cellSize={CELL_SIZE} width="100%" />
                    </div>
                </div>
            )}
        </div>
    );
  };

  // --- NTM THREAD LIST RENDER ---
  const renderThreadList = () => {
    const visibleThreads = tm.threads.filter(t => {
        if (t.status === 'active' || t.status === 'accepted') return true;
        if (t.status === 'frozen' && showFrozen) return true;
        if (t.status === 'rejected' && showRejected) return true;
        return false;
    });

    const sortedThreads = visibleThreads.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

    return (
      <div className="thread-list-wrapper" style={{ width: '90%' }}>
          <div className="ntm-view-controls" style={{ display: 'flex', gap: '15px', marginBottom: '10px', fontSize: '0.9rem', color: '#555', width: '90%', maxWidth: '1200px', margin: '0 auto 10px auto' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input type="checkbox" checked={showFrozen} onChange={(e) => setShowFrozen(e.target.checked)} style={{ marginRight: '6px' }} />
                  Show History (Frozen)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input type="checkbox" checked={showRejected} onChange={(e) => setShowRejected(e.target.checked)} style={{ marginRight: '6px' }} />
                  Show Rejected
              </label>
          </div>
          <div className="thread-list-container" style={{ padding: '15px' }}>
            {!showRejected && tm.threads.some(t => t.reason === "No Start Node") ? (
                <div className="empty-threads">No Start Node found in diagram.</div>
            ) : (
                !showRejected && sortedThreads.length === 0 && tmStepCount > 0 && (
                    <div className="empty-threads">All threads rejected (Hidden).</div>
                )
            )}

            {sortedThreads.map((thread) => {
                const depth = thread.id.split('.').length - 1;
                const indent = depth * 35; 
                const hasConnector = depth > 0;

                // 1. Calculate if this specific thread is caught in the timeout
                const isTimedOut = thread.status === 'active' && isTimeout;
                
                // 2. Override status: If timed out, treat as 'rejected' (Red Badge)
                const effectiveStatus = isTimedOut ? 'rejected' : thread.status;

                return (
                    <div key={thread.id} className="thread-tree-row" style={{ marginLeft: `${indent}px` }}>
                        {hasConnector && <div className="tree-connector"></div>}
                        
                        {/* Use effectiveStatus for the card border color */}
                        <div className={`thread-card ${effectiveStatus} tree-card`}>
                            <div className="thread-header">
                                <div className="thread-id-info">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '14px', height: '14px', borderRadius: '3px', backgroundColor: thread.color || '#e6194b', border: '1px solid rgba(0,0,0,0.1)' }} />
                                        <span className="thread-name">Thread {thread.id}</span>
                                    </div>
                                    <span className="thread-meta">
                                        {thread.status === 'frozen' ? ` (Split at Step ${thread.stepCount})` : ` (Step ${thread.stepCount})`}
                                    </span>
                                </div>

                                {/* BADGE LOGIC */}
                                <span 
                                    className={`thread-status-badge ${effectiveStatus === 'active' ? 'active' : effectiveStatus}`}
                                    style={{ cursor: effectiveStatus === 'rejected' ? 'pointer' : 'default' }}
                                    onClick={() => {
                                        if (isTimedOut) alert("Rejected: Execution timed out (Max steps reached).");
                                        else if (thread.status === 'rejected') alert(thread.reason || "Thread halted at non-accepting state.");
                                    }}
                                >
                                    {/* Display 'TIME OUT' if that's why we stopped */}
                                    {isTimedOut ? '✖ TIME OUT' :
                                    thread.status === 'active' 
                                        ? (tmStepCount === 0 && !isRunning ? 'READY' : '● RUNNING') 
                                        : thread.status === 'frozen' ? '⑂ SPLIT' :
                                        thread.status === 'accepted' ? '✔ ACCEPTED' : '✖ REJECTED'}
                                </span>
                            </div>
                            <TapeDisplay tape={thread.tape} head={thread.head} activeLabel={activeLabel(thread.currentNodeId)} cellSize={40} width="100%" />
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
        {isNonDeterministic ? renderThreadList() : renderStandardCard()}

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
            onReset={handleRestart}
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