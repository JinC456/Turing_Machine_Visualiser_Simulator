/* src/visualComponents/ConvertedDiagramModal.jsx */
import React, { useState, useEffect, useCallback, useMemo, useRef, useReducer } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { convertMultiToSingle } from '../simulatorComponents/engines/convertMultiToSingle';
import { getStartNode } from '../simulatorComponents/engines/Deterministic';
import StartNode   from './StartNode';
import NormalNode  from './NormalNode';
import AcceptNode  from './AcceptNode';
import DraggableEdge from './DraggableEdge';
import TapeDisplay from '../simulatorComponents/TapeDisplay';
import PlaybackControls from '../simulatorComponents/PlaybackControls';

const nodeTypes = { start: StartNode, normal: NormalNode, accept: AcceptNode };
const edgeTypes = { draggable: DraggableEdge };
const CELL_SIZE = 40;
const PADDING   = 60;

// ── Build the initial tape for the converted single-tape machine ───────────
function buildInitialTape(inputStr, mtEdges) {
  let numTapes = 2;
  (mtEdges || []).forEach(e => {
    (e.data?.labels || []).forEach(l => {
      Object.keys(l).forEach(k => {
        if (k.startsWith('tape')) {
          const n = parseInt(k.replace('tape', ''), 10);
          if (!isNaN(n)) numTapes = Math.max(numTapes, n);
        }
      });
    });
  });

  const inputChars = inputStr ? inputStr.split('') : [];
  const blanks = Array(PADDING).fill('␣');

  let tape = [...blanks, '|'];
  if (inputChars.length > 0) {
    const firstChar = inputChars[0] === ' ' ? '␣' : inputChars[0];
    tape.push('^' + firstChar);
    tape.push(...inputChars.slice(1).map(c => c === ' ' ? '␣' : c));
  } else {
    tape.push('^␣');   
  }

  for (let i = 1; i < numTapes; i++) {
    tape.push('|');
    tape.push('^␣');   
  }
  tape.push('|');
  tape.push(...blanks);

  return { tape, head: PADDING }; // head starts on the first |
}

// ── Auto-pan ───────────────────────────────────────────────────────────────
function useAutoPan(activeNodeId, isRunning) {
  const { setCenter, getNodes } = useReactFlow();
  const prevId = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!activeNodeId || activeNodeId === prevId.current) return;
    prevId.current = activeNodeId;

    const delay = isRunning ? 300 : 50;

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const target = getNodes().find(n => n.id === activeNodeId);
      if (!target) return;
      const { x, y } = target.position;
      const w = target.width  ?? 150;
      const h = target.height ?? 50;
      setCenter(x + w / 2, y + h / 2, { duration: isRunning ? 0 : 250, zoom: 1 });
    }, delay);

    return () => clearTimeout(timerRef.current);
  }, [activeNodeId, isRunning, setCenter, getNodes]);
}

// ── Live diagram (inside ReactFlowProvider) ────────────────────────────────
function LiveDiagram({ rawNodes, rawEdges, activeNodeId, activeEdgeId, activeSymbol, isRunning }) {
  
  const initialNodes = useMemo(() => rawNodes.map(n => ({
    ...n, 
    style: { ...(n.style || {}), border: '2px solid #aaa', borderRadius: 8 }
  })), [rawNodes]);

  const initialEdges = useMemo(() => rawEdges.map(e => ({
    ...e, 
    markerEnd: { ...e.markerEnd, color: '#333' }
  })), [rawEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Hook handles auto-panning directly
  useAutoPan(activeNodeId, isRunning);

  useEffect(() => {
    // 1. UPDATE NODES (Self-healing & High-performance)
    setNodes(nds => nds.map(n => {
      const isTarget = n.id === activeNodeId;
      const isCurrentlyActive = !!n.data?.isActive;

      // Case A: This is the active node, but it's not yellow yet.
      if (isTarget && !isCurrentlyActive) {
        return { 
          ...n, 
          data: { ...n.data, isActive: true }, 
          style: { ...n.style, border: '3px solid #e8d71a', boxShadow: '0 0 12px 3px rgba(232,215,26,0.6)' } 
        };
      }
      
      // Case B: This node IS yellow, but it shouldn't be (Cleans up ALL ghosts instantly)
      if (!isTarget && isCurrentlyActive) {
        return { 
          ...n, 
          data: { ...n.data, isActive: false }, 
          style: { ...n.style, border: '2px solid #aaa', boxShadow: 'none' } 
        };
      }
      
      // Case C: Node is fine. Return EXACT reference to prevent React re-renders.
      return n; 
    }));

    // 2. UPDATE EDGES
    setEdges(eds => eds.map(e => {
      const isTarget = e.id === activeEdgeId;
      const isCurrentlyActive = !!e.data?.isActive;
      const symbolChanged = e.data?.activeSymbol !== activeSymbol;

      // Update if it's the target and needs highlighting, OR if the active symbol changed (e.g., self-loops)
      if (isTarget && (!isCurrentlyActive || symbolChanged)) {
        return { 
          ...e, 
          markerEnd: { ...e.markerEnd, color: '#e8d71a' }, 
          data: { ...e.data, isActive: true, activeSymbol } 
        };
      }

      // Cleanup ghosts
      if (!isTarget && isCurrentlyActive) {
        return { 
          ...e, 
          markerEnd: { ...e.markerEnd, color: '#333' }, 
          data: { ...e.data, isActive: false, activeSymbol: null } 
        };
      }

      return e;
    }));

  }, [activeNodeId, activeEdgeId, activeSymbol, setNodes, setEdges]);

  return (
    <ReactFlow
      nodes={nodes} edges={edges}
      nodeTypes={nodeTypes} edgeTypes={edgeTypes}
      onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
      fitView fitViewOptions={{ padding: 0.3 }}
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}

// ── Single-tape DTM simulation hook ─────────────────────────────────────────
function simInit(rawNodes, mtEdges, localInput) {
  const startNode = getStartNode(rawNodes);
  if (!startNode) return null;
  const { tape, head } = buildInitialTape(localInput, mtEdges);
  return {
    tape, head,
    currentNodeId: startNode.id,
    activeEdgeId: null,
    stepCount: 0,
    status: 'IDLE',
    statusMessage: 'Initialized. Press Start or Step.',
  };
}

function simReducer(state, action) {
  switch (action.type) {
    case 'INIT':
      return { ...action.payload, history: [] };

    case 'STEP': {
      const { result, PAD } = action;
      const snapshot = {
        tape: state.tape, head: state.head,
        currentNodeId: state.currentNodeId, activeEdgeId: state.activeEdgeId,
        stepCount: state.stepCount, status: state.status, statusMessage: state.statusMessage,
      };
      if (result.halted) {
        return { ...state, status: 'REJECTED', statusMessage: `Halted: ${result.reason}`,
          activeEdgeId: null, history: [...state.history, snapshot] };
      }
      const newTape = [...state.tape];
      newTape[state.head] = result.write;
      let newHead = state.head;
      if (result.direction === 'R') newHead++;
      if (result.direction === 'L') newHead--;
      if (newHead < 0) { newTape.unshift(...Array(PAD).fill('\u2423')); newHead += PAD; }
      while (newHead >= newTape.length) newTape.push('\u2423');
      return {
        ...state,
        tape: newTape, head: newHead,
        currentNodeId: result.toNodeId,
        activeEdgeId: result.edgeId,
        stepCount: result.stepCount,
        status: result.isAccept ? 'ACCEPTED' : 'RUNNING',
        statusMessage: result.isAccept ? 'ACCEPTED!' : state.statusMessage,
        history: [...state.history, snapshot],
      };
    }

    case 'UNDO': {
      if (state.history.length === 0) return state;
      const prev = state.history[state.history.length - 1];
      return { ...state, ...prev, history: state.history.slice(0, -1) };
    }

    default: return state;
  }
}

function useDTMSimulation(rawNodes, rawEdges, mtEdges, initialInput) {
  const [localInput, setLocalInput] = useState(initialInput || '');
  const [isRunning, setIsRunning]   = useState(false);
  const [speed, setSpeed]           = useState(1);

  const [sim, dispatch] = useReducer(simReducer, null, () => ({
    tape: [], head: 0, currentNodeId: null, activeEdgeId: null,
    stepCount: 0, status: 'IDLE', statusMessage: 'Ready.', history: [],
  }));

  const edgeIndex = useMemo(() => {
    const nodeMap = Object.fromEntries(rawNodes.map(n => [n.id, n]));
    const idx = {};
    for (const e of rawEdges) {
      const enriched = {
        ...e,
        _targetIsAccept: nodeMap[e.target]?.type === 'accept',
      };
      (idx[e.source] ||= []).push(enriched);
    }
    return idx;
  }, [rawNodes, rawEdges]);

  const initialize = useCallback(() => {
    const payload = simInit(rawNodes, mtEdges, localInput);
    if (!payload) return;
    dispatch({ type: 'INIT', payload });
    setIsRunning(false);
  }, [rawNodes, mtEdges, localInput]);

  useEffect(() => { initialize(); }, [initialize]);

  const step = useCallback(() => {
    if (sim.status === 'ACCEPTED' || sim.status === 'REJECTED') return;
    const outgoing = edgeIndex[sim.currentNodeId] || [];
    const read = sim.tape[sim.head] || '␣';

    let matched = null;
    for (const edge of outgoing) {
      const rule = (edge.data?.labels || []).find(
        l => l.read === read || (l.read === '␣' && read === '')
      );
      if (rule) { matched = { edge, rule }; break; }
    }

    if (!matched) {
      dispatch({ type: 'STEP', result: { halted: true, reason: 'No transition defined', read, fromNodeId: sim.currentNodeId, stepCount: sim.stepCount }, PAD: PADDING });
      return;
    }

    const { edge, rule } = matched;
    dispatch({ type: 'STEP', result: {
      halted: false,
      read, write: rule.write, direction: rule.direction,
      fromNodeId: sim.currentNodeId,
      toNodeId: edge.target,
      edgeId: edge.id,
      isAccept: edge._targetIsAccept,
      rule,
      stepCount: sim.stepCount + 1,
    }, PAD: PADDING });
  }, [sim, edgeIndex]);

  useEffect(() => {
    if (!isRunning || sim.status === 'ACCEPTED' || sim.status === 'REJECTED') {
      if (sim.status === 'ACCEPTED' || sim.status === 'REJECTED') setIsRunning(false);
      return;
    }
    const interval = setInterval(step, 1000 / speed);
    return () => clearInterval(interval);
  }, [isRunning, step, speed, sim.status]);

  return {
    localInput, setLocalInput,
    tape: sim.tape, head: sim.head,
    currentNodeId: sim.currentNodeId, activeEdgeId: sim.activeEdgeId,
    stepCount: sim.stepCount, status: sim.status, statusMessage: sim.statusMessage,
    isRunning, setIsRunning,
    speed, setSpeed,
    history: sim.history,
    initialize,
    undo: () => { dispatch({ type: 'UNDO' }); setIsRunning(false); },
    step,
    handleClear: () => setLocalInput(''),
  };
}

// ── Main modal ─────────────────────────────────────────────────────────────
export default function ConvertedDiagramModal({ nodes: mtNodes, edges: mtEdges, onClose }) {
  const defaultInput = mtNodes.find(n => n.type === 'start')?.data?.input || '';

  const { nodes: rawNodes, edges: rawEdges } = useMemo(
    () => convertMultiToSingle(mtNodes, mtEdges),
    [mtNodes, mtEdges]
  );

  const sim = useDTMSimulation(rawNodes, rawEdges, mtEdges, defaultInput);

  const activeSymbol = useMemo(() => {
    return sim.tape[sim.head] ?? '␣';
  }, [sim.tape, sim.head]);

  const activeNodeLabel = useMemo(() => {
    const n = rawNodes.find(n => n.id === sim.currentNodeId);
    return n?.data?.label || sim.currentNodeId || '';
  }, [rawNodes, sim.currentNodeId]);


  const isAccepted = sim.status === 'ACCEPTED';
  const isRejected = sim.status === 'REJECTED';
  const isFinished = isAccepted || isRejected;
  const cardStatus = isAccepted ? 'accepted' : isRejected ? 'rejected' : sim.status === 'RUNNING' ? 'active' : 'active';
  const badgeLabel = isAccepted ? '✔ ACCEPTED' : isRejected ? '✖ REJECTED' : sim.isRunning ? '● RUNNING' : 'READY';

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.80)',
      zIndex: 2000,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', borderRadius: 10,
        width: '96vw', height: '94vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 8px 40px rgba(0,0,0,0.45)',
      }}>

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 18px', borderBottom: '1px solid #e0e0e0',
          background: '#fafafa', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{
              padding: '6px 13px', borderRadius: 6, cursor: 'pointer',
              background: 'transparent', border: '1px solid #ccc',
              fontSize: 20, lineHeight: 1, color: '#555',
            }}>×</button>
          </div>
        </div>

        <div style={{
          flexShrink: 0, borderBottom: '2px solid #e0e0e0',
          padding: '12px 18px 10px', background: '#fdfdfd',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div className={`thread-card ${cardStatus} tree-card`} style={{ width: '100%', marginTop: 0 }}>
            <div className="thread-header">
              <div className="thread-id-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: '#333', border: '1px solid rgba(0,0,0,0.1)' }} />
                  <span className="thread-name">Sipser Single-Tape Equivalent</span>
                </div>
                <span className="thread-meta">
                  Step: {sim.stepCount}
                </span>
              </div>
              <span
                className={`thread-status-badge ${cardStatus}`}
                onClick={() => isRejected && alert(sim.statusMessage)}
                title={isRejected ? 'Click to see reason' : ''}
                style={{ cursor: isRejected ? 'pointer' : 'default' }}
              >
                {badgeLabel}
              </span>
            </div>
            <TapeDisplay
              tape={sim.tape}
              head={sim.head}
              activeLabel={activeNodeLabel}
              cellSize={CELL_SIZE}
              width="100%"
            />
          </div>

          <div style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            gap: 22, flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontWeight: 500, color: '#555', fontSize: 13 }}>Input:</label>
              <input
                type="text"
                value={sim.localInput}
                onChange={e => sim.setLocalInput(e.target.value)}
                disabled={sim.isRunning}
                style={{
                  padding: '5px 8px', borderRadius: 4, border: '1px solid #ccc',
                  fontSize: 13, width: 160, fontFamily: 'monospace',
                }}
              />
            </div>

            <PlaybackControls
              onStepForward={sim.step}
              onStart={() => sim.setIsRunning(true)}
              onStop={() => sim.setIsRunning(false)}
              onReset={sim.initialize}
              onClear={sim.handleClear}
              onStepBack={sim.undo}
              isRunning={sim.isRunning}
              isFinished={isFinished}
              canUndo={sim.history.length > 0}
            />

            <div className="speed-control" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <label>Speed: {sim.speed}x</label>
              <input
                type="range" min="0.25" max="2" step="0.25"
                value={sim.speed}
                onChange={e => sim.setSpeed(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{
            display: 'flex', gap: 20, flexWrap: 'wrap',
            padding: '5px 14px', background: '#f8f8f8',
            borderBottom: '1px solid #e8e8e8',
            fontSize: 12, alignItems: 'center', flexShrink: 0,
          }}>
            <span style={{ color: '#555' }}>States: <strong>{rawNodes.length}</strong></span>
            <span style={{ color: '#555' }}>Transitions: <strong>{rawEdges.length}</strong></span>
          </div>

          <div style={{ flex: 1, minHeight: 0 }}>
            <ReactFlowProvider>
              <LiveDiagram
                rawNodes={rawNodes}
                rawEdges={rawEdges}
                activeNodeId={sim.currentNodeId}
                activeEdgeId={sim.activeEdgeId}
                activeSymbol={activeSymbol}
                isRunning={sim.isRunning}
              />
            </ReactFlowProvider>
          </div>
        </div>

      </div>
    </div>
  );
}