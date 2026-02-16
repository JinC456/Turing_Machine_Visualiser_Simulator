/* src/simulatorComponents/singleTapeModal.jsx */
import React, { useState, useEffect, useCallback } from 'react';
import TapeDisplay from './TapeDisplay';
import PlaybackControls from './PlaybackControls';
import { findTransition, isAcceptNode } from './engines/MultiTape';
import '../Visualiser.css';

const CELL_SIZE = 40;

export default function SingleTapeModal({ nodes, edges, initialInput, onClose }) {
    // --- State: Inputs ---
    const [localInput, setLocalInput] = useState(initialInput || "");

    // --- State: Tape Physics ---
    const [tape, setTape] = useState([]);
    const [head, setHead] = useState(0);
    const [phase, setPhase] = useState("IDLE"); // IDLE, SCANNING, CALCULATE, REWIND_TO_START, SEEK_TARGET, EXECUTE_WRITE, REWIND_TO_RESET
    
    // --- State: Machine Logic ---
    const [activeNodeId, setActiveNodeId] = useState(null);
    const [stepCount, setStepCount] = useState(0);
    const [scannedSymbols, setScannedSymbols] = useState([]); // Symbols read during SCAN
    const [markerPositions, setMarkerPositions] = useState([]); // Indices of markers found during SCAN
    
    // --- State: Update Cycle ---
    const [pendingAction, setPendingAction] = useState(null); // The transition to execute
    const [updateIndex, setUpdateIndex] = useState(0); // Which virtual tape are we currently updating?
    const [tapeOffset, setTapeOffset] = useState(0); // Tracks shifts (splices) during the current update cycle

    // --- State: Playback ---
    const [isRunning, setIsRunning] = useState(false);
    const [statusMessage, setStatusMessage] = useState("Ready to initialize.");
    const [speed, setSpeed] = useState(1);

    // --- Sync Prop to Local State ---
    useEffect(() => {
        setLocalInput(initialInput || "");
    }, [initialInput]);

    // --- Initialization ---
    const initialize = useCallback(() => {
        const startNode = nodes.find(n => n.type === 'start');
        if (!startNode) {
            setStatusMessage("Error: No Start Node found.");
            return;
        }

        // USE LOCAL INPUT HERE
        const inputChars = localInput ? localInput.split('') : [""];

        // Determine number of tapes from edge labels
        let numTapes = 2; // Default minimum
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

        // Construct Initial Tape: | ^input... | ^ | ... |
        const PADDING = 50; // Set your default padding here
        const blanks = Array(PADDING).fill("");

        // Construct Initial Tape with large blank buffers
        let newTape = [...blanks, "|"];

        // Tape 1 (Input)
        if (inputChars.length > 0 && inputChars[0] !== "") {
            newTape.push("^" + inputChars[0]);
            newTape.push(...inputChars.slice(1));
        } else {
            newTape.push("^");
        }

        // Other Tapes
        for (let i = 1; i < numTapes; i++) {
            newTape.push("|");
            newTape.push("^");
        }
        newTape.push("|");
        newTape.push(...blanks); // Add blanks at the end

        setTape(newTape);
        setHead(PADDING);
        setActiveNodeId(startNode.id);
        setStepCount(0);
        setPhase("IDLE");
        setScannedSymbols([]);
        setMarkerPositions([]);
        setPendingAction(null);
        setUpdateIndex(0);
        setTapeOffset(0);
        setIsRunning(false);
        setStatusMessage("Initialized. Press Start or Step.");
    }, [nodes, edges, localInput]); // Added localInput as dependency

    useEffect(() => {
        initialize();
    }, [initialize]);


    // --- Core Sipser Step Logic ---
    const step = useCallback(() => {
        // 1. Create a copy of the current tape to work on
        let newTape = [...tape];
        let newHead = head;
        
        // --- PHASE 1: SCANNING (Read Sweep) ---
        if (phase === "SCANNING") {
            const cell = newTape[head];

            // If we found a marker (Virtual Head)
            if (typeof cell === "string" && cell.includes("^")) {
                let val = cell.replace("^", "");
                if (val === "") val = "␣"; // Normalize Blank
                
                setScannedSymbols(prev => [...prev, val]);
                setMarkerPositions(prev => [...prev, head]);
            }

            // Move Head
            newHead = head + 1;

            // --- CHANGE HERE ---
            // Stop scanning when we reach the last | delimiter
            const lastDelimiterIndex = newTape.lastIndexOf("|");
            if (newHead > lastDelimiterIndex) {
                setPhase("CALCULATE");
                setHead(newHead);
                return;
            }
            
            setHead(newHead);
            return;
        }

        // --- PHASE 2: CALCULATE (Instant) ---
        if (phase === "CALCULATE") {
            const transition = findTransition(activeNodeId, scannedSymbols, edges);

            if (!transition) {
                setPhase("HALTED");
                setStatusMessage("Halted: No valid transition found.");
                setIsRunning(false);
                return;
            }

            // Convert Rule Object into Arrays
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

            setPendingAction({ 
                ...transition, 
                writes: writes, 
                directions: directions 
            });

            setUpdateIndex(0); 
            setTapeOffset(0);  
            setPhase("REWIND_TO_START");
            return;
        }

        // --- PHASE 3: REWIND ---
        if (phase === "REWIND_TO_START") {
            const firstDelimiterIndex = newTape.indexOf("|");
            if (head > firstDelimiterIndex) {
                setHead(head - 1);
            } else {
                setPhase("SEEK_TARGET");
            }
            return;
        }

        // --- PHASE 4: SEEK TARGET ---
        if (phase === "SEEK_TARGET") {
            const targetPos = markerPositions[updateIndex] + tapeOffset;

            if (head < targetPos) {
                setHead(head + 1);
            } else if (head > targetPos) {
                setHead(head - 1); 
            } else {
                setPhase("EXECUTE_WRITE");
            }
            return;
        }

        // --- PHASE 5: EXECUTE WRITE ---
        if (phase === "EXECUTE_WRITE") {
            const idx = updateIndex;
            let writeVal = pendingAction.writes[idx];
            const moveDir = pendingAction.directions[idx];
            
            if (writeVal === "␣") writeVal = "";

            // 1. Overwrite Current Cell
            newTape[head] = writeVal; 

            // 2. Calculate New Position & Handle Shifts
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

            // 3. Place New Marker
            const existingVal = newTape[newMarkerPos] || "";
            const cleanVal = existingVal.replace("^", "");
            newTape[newMarkerPos] = "^" + cleanVal;

            // 4. Update Offset
            if (shiftOccurred > 0) {
                setTapeOffset(prev => prev + 1);
            }

            // 5. Commit Tape Changes
            setTape(newTape);

            // 6. Check completion
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

        // --- PHASE 6: RESET ---
        if (phase === "REWIND_TO_RESET") {
            const firstDelimiterIndex = newTape.indexOf("|");
            if (head > firstDelimiterIndex) {
                setHead(head - 1);
            } else {
                setScannedSymbols([]);
                setMarkerPositions([]);
                setTapeOffset(0);
                setStepCount(c => c + 1);
                setPhase("SCANNING");
            }
            return;
        }
        
        if (phase === "IDLE") {
             setPhase("SCANNING");
        }

    }, [head, phase, tape, activeNodeId, scannedSymbols, markerPositions, updateIndex, tapeOffset, pendingAction, edges, nodes]);

    // --- Timer for Animation ---
    useEffect(() => {
        let interval;
        if (isRunning && !["HALTED", "ACCEPTED"].includes(phase)) {
            interval = setInterval(step, 1000 / speed ); 
        }
        return () => clearInterval(interval);
    }, [isRunning, step, speed, phase]);


    const activeNodeLabel = nodes.find(n => n.id === activeNodeId)?.data?.label || "Start";

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000,
            display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
            <div style={{
                backgroundColor: 'white', padding: '20px', borderRadius: '8px',
                width: '90%', maxWidth: '1000px', maxHeight: '90vh',
                overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px'
            }}>
                <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', borderBottom: '1px solid #eee',
                    paddingBottom: '10px'
                }}>
                    <h2 style={{ margin: 0 }}>Sipser Single Tape Emulator</h2>
                    <button onClick={onClose}
                        style={{ border: 'none', background: 'none',
                        fontSize: '24px', cursor: 'pointer' }}>×</button>
                </div>

                <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px' }}>
                    <div style={{ textAlign: 'left', marginBottom: '10px', fontWeight: 'bold' }}>
                        Macro-Step: {stepCount} | Phase: {phase}
                    </div>
                    
                    

                    <TapeDisplay
                        tape={tape}
                        head={head}
                        activeLabel={activeNodeLabel}
                        cellSize={CELL_SIZE}
                        width="100%"
                    />

                    <div style={{
                        marginTop: '15px', padding: '8px',
                        background: '#e1f5fe', color: '#0277bd',
                        borderRadius: '4px'
                    }}>
                        {statusMessage}
                    </div>
                </div>

                <div className="controls-row"
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '25px',
                        flexWrap: 'wrap',
                        width: '100%'
                    }}
                >
                    {/* Input Box */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontWeight: '500', color: '#555' }}>
                            Input:
                        </label>
                        <input
                            type="text"
                            value={localInput}
                            onChange={(e) => setLocalInput(e.target.value)}
                            disabled={isRunning}
                            placeholder="Enter input string..."
                            style={{
                                padding: '6px 8px',
                                borderRadius: '4px',
                                border: '1px solid #ccc',
                                fontSize: '14px',
                                width: '180px',
                                fontFamily: 'monospace'
                            }}
                        />
                    </div>

                    {/* Playback Controls */}
                    <PlaybackControls
                        onStepForward={step}
                        onStart={() => setIsRunning(true)}
                        onStop={() => setIsRunning(false)}
                        onReset={initialize}
                        onClear={initialize}
                        isRunning={isRunning}
                        isFinished={["HALTED", "ACCEPTED"].includes(phase)}
                        canUndo={false}
                    />

                    {/* Speed Slider */}
                    <div className="speed-control" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label>Speed: {speed}x</label>
                        <input
                            type="range"
                            min="0.25"
                            max="2"
                            step="0.25"
                            value={speed}
                            onChange={(e) => setSpeed(Number(e.target.value))}
                        />
                    </div>

                </div>


                <div style={{ borderTop: '1px solid #eee', paddingTop: '15px' }}>
                    <h3>Emulation Logic</h3>
                    <p style={{ lineHeight: '1.6', color: '#444', fontSize: '0.9em' }}>
                        This simulation enforces <b>Sipser's Single-Tape Equivalence</b>. 
                        Unlike a standard Multi-Tape simulator, the head cannot teleport. 
                        For every macro-step, the single head must:
                        <br/>1. <b>Scan</b> the entire tape to read all virtual heads (marked with ^).
                        <br/>2. <b>Rewind</b> to the start.
                        <br/>3. <b>Seek</b> each virtual head sequentially to update it.
                        <br/>4. <b>Shift</b> tape contents if a virtual head runs into a delimiter (|).
                    </p>
                </div>
            </div>
        </div>
    );
}