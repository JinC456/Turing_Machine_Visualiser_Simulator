/* src/simulatorComponents/singleTapeModal.jsx */
import React, { useState, useEffect, useCallback } from 'react';
import TapeDisplay from './TapeDisplay';
import PlaybackControls from './PlaybackControls';
import { findTransition, isAcceptNode } from './engines/MultiTape';
import '../Visualiser.css';

const CELL_SIZE = 40;

export default function SingleTapeModal({ nodes, edges, initialInput, onClose }) {
    const [localInput, setLocalInput] = useState(initialInput || "");
    const [tape, setTape] = useState([]);
    const [head, setHead] = useState(0);
    const [phase, setPhase] = useState("IDLE"); 
    const [activeNodeId, setActiveNodeId] = useState(null);
    const [stepCount, setStepCount] = useState(0);      
    const [microStep, setMicroStep] = useState(0);     
    const [scannedSymbols, setScannedSymbols] = useState([]); 
    const [markerPositions, setMarkerPositions] = useState([]); 
    const [pendingAction, setPendingAction] = useState(null); 
    const [updateIndex, setUpdateIndex] = useState(0); 
    const [tapeOffset, setTapeOffset] = useState(0); 
    const [isRunning, setIsRunning] = useState(false);
    const [statusMessage, setStatusMessage] = useState("Ready to initialize.");
    const [speed, setSpeed] = useState(1);
    const [history, setHistory] = useState([]);

    useEffect(() => {
        setLocalInput(initialInput || "");
    }, [initialInput]);

    const initialize = useCallback(() => {
        const inputChars = localInput ? localInput.split('') : [""];
        let numTapes = 2; 
        
        if (edges) {
            edges.forEach(e => {
                e.data?.labels?.forEach(l => {
                    Object.keys(l).forEach(k => {
                        if (k.startsWith('tape')) {
                            const n = parseInt(k.replace('tape', ''));
                            if (!isNaN(n)) numTapes = Math.max(numTapes, n);
                        }
                    });
                });
            });
        }

        const PADDING = 50; 
        const blanks = Array(PADDING).fill("");
        let newTape = [...blanks, "|"];

        if (inputChars.length > 0 && inputChars[0] !== "") {
            newTape.push("^" + inputChars[0]);
            newTape.push(...inputChars.slice(1));
        } else {
            newTape.push("^");
        }

        for (let i = 1; i < numTapes; i++) {
            newTape.push("|");
            newTape.push("^");
        }
        newTape.push("|");
        newTape.push(...blanks); 

        setTape(newTape);
        setHead(PADDING);
        setStepCount(1);
        setMicroStep(0); 
        setPhase("IDLE");
        setScannedSymbols([]);
        setMarkerPositions([]);
        setPendingAction(null);
        setUpdateIndex(0);
        setTapeOffset(0);
        setIsRunning(false);
        setHistory([]); 

       const startNode = nodes.find(n => n.type === 'start');
        
        if (!startNode) {
            setActiveNodeId(null);
            setStatusMessage("Error: No Start Node found."); 
            return;
        }

        setActiveNodeId(startNode.id);
        setStatusMessage("Initialized. Press Start or Step.");

    }, [nodes, edges, localInput]);

    useEffect(() => {
        initialize();
    }, [initialize]);

    const undo = useCallback(() => {
        if (history.length === 0) return;
        const lastState = history[history.length - 1];
        setTape(lastState.tape);
        setHead(lastState.head);
        setPhase(lastState.phase);
        setActiveNodeId(lastState.activeNodeId);
        setStepCount(lastState.stepCount);
        setMicroStep(lastState.microStep); // Restore physical counter
        setScannedSymbols(lastState.scannedSymbols);
        setMarkerPositions(lastState.markerPositions);
        setPendingAction(lastState.pendingAction);
        setUpdateIndex(lastState.updateIndex);
        setTapeOffset(lastState.tapeOffset);
        setHistory(prev => prev.slice(0, -1));
    }, [history]);

    const handleClear = useCallback(() => {
        setLocalInput(""); 
    }, []);

    const step = useCallback(() => {
        // Save History
        const snapshot = {
            tape: [...tape], head, phase, activeNodeId, stepCount, microStep,
            scannedSymbols: [...scannedSymbols], markerPositions: [...markerPositions],
            pendingAction, updateIndex, tapeOffset
        };
        setHistory(prev => [...prev, snapshot]);

        // Increment Physical Step Counter
        setMicroStep(prev => prev + 1);

        let newTape = [...tape];
        let newHead = head;
        
        if (phase === "SCANNING") {
            const cell = newTape[head];
            if (typeof cell === "string" && cell.includes("^")) {
                let val = cell.replace("^", "");
                if (val === "") val = "␣"; 
                setScannedSymbols(prev => [...prev, val]);
                setMarkerPositions(prev => [...prev, head]);
            }
            newHead = head + 1;
            const lastDelimiterIndex = newTape.lastIndexOf("|");
            if (newHead >= lastDelimiterIndex) {
                setPhase("CALCULATE");
                setHead(head); 
                return;
            }
            setHead(newHead);
            return;
        }

        if (phase === "CALCULATE") {
            const transition = findTransition(activeNodeId, scannedSymbols, edges);
            if (!transition) {
                setPhase("HALTED");
                setStatusMessage("Halted: No valid transition found.");
                setIsRunning(false);
                return;
            }
            const writes = [];
            const directions = [];
            for (let i = 0; i < scannedSymbols.length; i++) {
                const tapeKey = `tape${i + 1}`;
                const ruleData = transition.rule[tapeKey];
                if (ruleData) {
                    writes.push(ruleData.write);
                    directions.push(ruleData.direction);
                } else {
                    writes.push(scannedSymbols[i]); 
                    directions.push("N");
                }
            }
            setPendingAction({ ...transition, writes, directions });
            setUpdateIndex(0); 
            setTapeOffset(0);  
            setPhase("REWIND_TO_START");
            return;
        }

        if (phase === "REWIND_TO_START") {
            const firstDelimiterIndex = newTape.indexOf("|");
            if (head > firstDelimiterIndex) {
                setHead(head - 1);
            } else {
                setPhase("SEEK_TARGET");
            }
            return;
        }

        if (phase === "SEEK_TARGET") {
            const targetPos = markerPositions[updateIndex] + tapeOffset;
            if (head < targetPos) setHead(head + 1);
            else if (head > targetPos) setHead(head - 1); 
            else setPhase("EXECUTE_WRITE");
            return;
        }

        if (phase === "EXECUTE_WRITE") {
            const idx = updateIndex;
            let writeVal = pendingAction.writes[idx];
            const moveDir = pendingAction.directions[idx];
            if (writeVal === "␣") writeVal = "";
            newTape[head] = writeVal; 

            let newMarkerPos = head;
            let shiftOccurred = 0;
            if (moveDir === "R") {
                newMarkerPos = head + 1;
                if (newMarkerPos >= newTape.length) newTape.push("");
                if (newTape[newMarkerPos] === "|") {
                    newTape.splice(newMarkerPos, 0, ""); 
                    shiftOccurred = 1;
                }
            } else if (moveDir === "L") {
                newMarkerPos = head - 1;
                if (newMarkerPos < 0 || newTape[newMarkerPos] === "|") {
                     newTape.splice(head, 0, ""); 
                     newMarkerPos = head; 
                     shiftOccurred = 1;
                }
            }

            const existingVal = newTape[newMarkerPos] || "";
            const cleanVal = existingVal.replace("^", "");
            newTape[newMarkerPos] = "^" + cleanVal;

            if (shiftOccurred > 0) setTapeOffset(prev => prev + 1);
            setTape(newTape);

            if (idx < pendingAction.writes.length - 1) {
                setUpdateIndex(prev => prev + 1);
                setPhase("SEEK_TARGET"); 
            } else {
                setActiveNodeId(pendingAction.toNodeId);
                const nextNode = nodes.find(n => n.id === pendingAction.toNodeId);
                if (isAcceptNode(nextNode)) {
                     setPhase("ACCEPTED");
                     setStatusMessage("ACCEPTED!");
                     setIsRunning(false);
                } else {
                    setPhase("REWIND_TO_RESET");
                }
            }
            setHead(newMarkerPos);
            return;
        }

        if (phase === "REWIND_TO_RESET") {
            const firstDelimiterIndex = newTape.indexOf("|");
            if (head > firstDelimiterIndex) {
                setHead(head - 1);
            } else {
                setScannedSymbols([]);
                setMarkerPositions([]);
                setTapeOffset(0);
                setStepCount(c => c + 1); // Only increment Macro-Step here
                setPhase("SCANNING"); 
            }
            return;
        }
        
        if (phase === "IDLE") setPhase("SCANNING");
    }, [head, phase, tape, activeNodeId, scannedSymbols, markerPositions, updateIndex, tapeOffset, pendingAction, edges, nodes, microStep]);

    useEffect(() => {
        let interval;
        if (isRunning && !["HALTED", "ACCEPTED"].includes(phase)) {
            interval = setInterval(step, 1000 / speed ); 
        }
        return () => clearInterval(interval);
    }, [isRunning, step, speed, phase]);

    const activeNodeLabel = nodes.find(n => n.id === activeNodeId)?.data?.label || "Start";

    const isAccepted = phase === "ACCEPTED";
    const isHalted = phase === "HALTED";
    const isActive = !isAccepted && !isHalted && phase !== "IDLE";
    let cardStatus = isActive ? "active" : isAccepted ? "accepted" : isHalted ? "rejected" : "active";
    let badgeLabel = isActive ? "● RUNNING" : isAccepted ? "✔ ACCEPTED" : isHalted ? "✖ HALTED" : "READY";

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000,
            display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
            {/* 1. UPDATE MAIN CONTAINER: Remove overflowY here */}
            <div style={{
                backgroundColor: 'white', padding: '20px', borderRadius: '8px',
                width: '90%', maxWidth: '1000px', maxHeight: '80vh',
                display: 'flex', flexDirection: 'column', gap: '20px'
            }}>
                {/* --- FIXED SECTION START --- */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px', flexShrink: 0 }}>
                    <h2 style={{ margin: 0 }}>Sipser Single Tape Conversion</h2>
                    <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
                </div>

                <div className="thread-list-container" style={{ flexShrink: 0 }}>
                    <div className={`thread-card ${cardStatus} tree-card`} style={{ width: '100%', marginTop: 0 }}>
                        <div className="thread-header">
                            <div className="thread-id-info">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '14px', height: '14px', borderRadius: '3px', backgroundColor: '#333', border: '1px solid rgba(0,0,0,0.1)' }} />
                                    <span className="thread-name">Simulation Tape</span>
                                </div>
                                <span className="thread-meta">
                                    Macro-Step: {stepCount} | Micro-Step: {microStep} | Phase: {phase}
                                </span>
                            </div>
                            <span 
                                className={`thread-status-badge ${cardStatus}`}
                                onClick={() => isHalted && alert(statusMessage)} 
                                title={isHalted ? "Click to see reason" : ""}
                                style={{ cursor: isHalted ? 'pointer' : 'default' }}
                            >
                                {badgeLabel}
                            </span>
                        </div>
                        <TapeDisplay tape={tape} head={head} activeLabel={activeNodeLabel} cellSize={CELL_SIZE} width="100%" />
                    </div>
                </div>

                <div className="controls-row" style={{ 
                    display: 'flex', justifyContent: 'center', alignItems: 'center', 
                    gap: '25px', flexWrap: 'wrap', width: '100%',
                    paddingTop: 0, marginTop: '-10px', flexShrink: 0
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontWeight: '500', color: '#555' }}>Input:</label>
                        <input 
                            type="text" 
                            value={localInput}
                            onChange={(e) => setLocalInput(e.target.value)}
                            disabled={isRunning}
                            style={{
                                padding: '6px 8px', borderRadius: '4px', border: '1px solid #ccc',
                                fontSize: '14px', width: '180px', fontFamily: 'monospace'
                            }}
                        />
                    </div>

                    <PlaybackControls
                        onStepForward={step}
                        onStart={() => setIsRunning(true)}
                        onStop={() => setIsRunning(false)}
                        onReset={initialize}
                        onClear={handleClear}
                        onStepBack={undo}
                        isRunning={isRunning}
                        isFinished={["HALTED", "ACCEPTED"].includes(phase)}
                        canUndo={history.length > 0}
                    />

                    <div className="speed-control" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label>Speed: {speed}x</label>
                        <input type="range" min="0.25" max="3" step="0.25" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
                    </div>
                </div>
                {/* --- FIXED SECTION END --- */}


                {/* 2. UPDATE EXPLANATION SECTION: Make THIS scrollable */}
                <div style={{ 
                    borderTop: '1px solid #eee', 
                    paddingTop: '15px',
                    overflowY: 'auto', // Scrollbar appears here
                    flex: 1,           // Takes remaining height
                    minHeight: 0       // Allows shrinking if needed
                }}>
                    <h3>Emulation Logic</h3>
                    <p style={{ lineHeight: '1.6', color: '#444', fontSize: '0.9em' }}>
                        This emulation demonstrates that a <b>Single-Tape Machine</b> can simulate a <b>Multi-Tape Machine</b> (Sipser, Theorem 3.13).
                        <br/><br/>
                        <b>Definitions:</b>
                        <br/>• <b>The Pointer (▼):</b> Represents the <i>single physical head</i> of this machine. Its position shows where the head currently is, and the label it carries indicates the <b>current state of the original Multi-Tape machine</b> corresponding to the macro-step being executed.
                        <br/>• <b>Macro-Step:</b> One logical transition of the Multi-Tape machine. For example, if the original machine has 2 tapes, a macro-step might be:
                            <br/>– Read 'a' on Tape 1 and 'b' on Tape 2  
                            <br/>– Write 'x' on Tape 1 and 'y' on Tape 2  
                            <br/>– Move Right on Tape 1 and Left on Tape 2
                        <br/>• <b>Micro-Step:</b> One physical movement of the single head (left or right) on the combined tape to reach and update a virtual head.
                        <br/><br/>
                        <b>The Cycle: </b>
                        <br/><br/>
                        To perform <b>1 Macro-Step</b>, the single head must perform multiple Micro-Steps:
                        <br/>1. <b>Scan:</b> Sweep the entire tape to read the symbols under all virtual heads (marked with ^). For 2 tapes, the pointer reads both '^a' and '^b'.
                        <br/>2. <b>Rewind:</b> Return to the first delimiter to reset the pointer for the updates.
                        <br/>3. <b>Seek & Update:</b> Move sequentially to each virtual head to write the new symbol and move the marker according to the macro-step instructions.
                        <br/>4. <b>Shift:</b> If a marker moves onto a delimiter, the tape is shifted to make space, maintaining the single-head simulation.
                    </p>
                </div>
            </div>
        </div>
    );
}