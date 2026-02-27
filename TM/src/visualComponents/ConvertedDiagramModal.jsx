/* src/visualComponents/ConvertedDiagramModal.jsx */
import React, { useState, useEffect, useCallback, useMemo, useRef, useReducer } from 'react';
import ReactFlow, {
  Background,
  Controls,
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

  return { tape, head: PADDING };
}

// ── Auto-pan ───────────────────────────────────────────────────────────────
// Always instant (duration:0). Runs on every stepCount change so self-loops
// also trigger a pan even when activeNodeId doesn't change.
function useAutoPan(activeNodeId, stepCount) {
  const { setCenter, getNodes } = useReactFlow();

  useEffect(() => {
    if (!activeNodeId) return;
    const target = getNodes().find(n => n.id === activeNodeId);
    if (!target) return;
    const { x, y } = target.position;
    const w = target.width  ?? 150;
    const h = target.height ?? 50;
    setCenter(x + w / 2, y + h / 2, { duration: 0, zoom: 1 });
  }, [activeNodeId, stepCount, setCenter, getNodes]);
}

// ── Live diagram (inside ReactFlowProvider) ────────────────────────────────
const BATCH_SIZE = 50; // nodes added per frame during initial load

function LiveDiagram({ rawNodes, rawEdges, activeNodeId, activeEdgeId, activeSymbol, stepCount, onReady }) {

  const styledNodes = useMemo(() => rawNodes.map(n => ({
    ...n,
    style: { ...(n.style || {}), border: 'none', boxShadow: 'none', background: 'transparent', transition: 'none' },
  })), [rawNodes]);

  const styledEdges = useMemo(() => rawEdges.map(e => ({
    ...e,
    markerEnd: { ...e.markerEnd, color: '#333' },
    data: { ...e.data, isActive: false, activeSymbol: null },
  })), [rawEdges]);

  // Progressive loading: start empty, add BATCH_SIZE nodes per rAF frame
  const [visibleCount, setVisibleCount] = useState(0);
  const isLoaded = visibleCount >= styledNodes.length;

  useEffect(() => {
    setVisibleCount(0); // reset on new graph
  }, [styledNodes]);

  useEffect(() => {
    if (isLoaded) { onReady?.(); return; }
    const raf = requestAnimationFrame(() => {
      setVisibleCount(c => Math.min(c + BATCH_SIZE, styledNodes.length));
    });
    return () => cancelAnimationFrame(raf);
  }, [visibleCount, isLoaded, styledNodes.length, onReady]);

  const visibleNodes = useMemo(() => styledNodes.slice(0, visibleCount), [styledNodes, visibleCount]);
  // Only show edges once all nodes are loaded (edges reference node positions)
  const visibleEdges = isLoaded ? styledEdges : [];

  const [nodes, setNodes, onNodesChange] = useNodesState(visibleNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(visibleEdges);

  // Sync as batches arrive and when fully loaded
  useEffect(() => { setNodes(visibleNodes); }, [visibleNodes, setNodes]);
  useEffect(() => { if (isLoaded) setEdges(styledEdges); }, [isLoaded, styledEdges, setEdges]);

  // Refs tracking what's currently highlighted so we know what to deactivate
  const prevNodeId = useRef(null);
  const prevEdgeId = useRef(null);
  const prevSymbol = useRef(null);

  // Node highlight: surgical O(1) patch
  useEffect(() => {
    if (!isLoaded) return;
    const prev = prevNodeId.current;
    prevNodeId.current = activeNodeId;
    setNodes(nds => nds.map(n => {
      if (n.id === prev && n.id !== activeNodeId)
        return { ...n, data: { ...n.data, isActive: false }, style: { ...n.style, border: 'none', boxShadow: 'none', background: 'transparent' } };
      if (n.id === activeNodeId)
        return { ...n, data: { ...n.data, isActive: true }, style: { ...n.style, border: 'none', boxShadow: 'none', background: 'transparent' } };
      return n;
    }));
  }, [activeNodeId, isLoaded, setNodes]);

  // Edge highlight: surgical O(1) patch
  useEffect(() => {
    if (!isLoaded) return;
    const prev = prevEdgeId.current;
    const edgeChanged = prev !== activeEdgeId;
    prevEdgeId.current = activeEdgeId;
    prevSymbol.current = activeSymbol;
    setEdges(eds => eds.map(e => {
      if (edgeChanged && e.id === prev && e.id !== activeEdgeId)
        return { ...e, markerEnd: { ...e.markerEnd, color: '#333' }, data: { ...e.data, isActive: false, activeSymbol: null } };
      if (e.id === activeEdgeId)
        return { ...e, markerEnd: { ...e.markerEnd, color: '#e8d71a' }, data: { ...e.data, isActive: true, activeSymbol } };
      return e;
    }));
  }, [activeEdgeId, activeSymbol, stepCount, isLoaded, setEdges]);

  // Auto-pan: only once loaded, instant, fires on every step including self-loops
  useAutoPan(isLoaded ? activeNodeId : null, stepCount);

  return (
    <ReactFlow
      nodes={nodes} edges={edges}
      nodeTypes={nodeTypes} edgeTypes={edgeTypes}
      onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
      fitView fitViewOptions={{ padding: 1.2 }}
      minZoom={0.05}
    >
      <Background />
      <Controls />
    </ReactFlow>
  );
}

// ── Single-tape DTM simulation ─────────────────────────────────────────────
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
        return {
          ...state, status: 'REJECTED',
          statusMessage: `Halted: ${result.reason}`,
          activeEdgeId: null,
          activeRead: null,
          history: [...state.history, snapshot],
        };
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
        activeRead: result.read,
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

  // Build edge index from rawEdges so the sim always uses the same IDs
  // that LiveDiagram's useEdgesState was initialised with.
  const edgeIndex = useMemo(() => {
    const nodeMap = Object.fromEntries(rawNodes.map(n => [n.id, n]));
    const idx = {};
    for (const e of rawEdges) {
      const enriched = { ...e, _targetIsAccept: nodeMap[e.target]?.type === 'accept' };
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
      dispatch({
        type: 'STEP',
        result: {
          halted: true, reason: 'No transition defined',
          read, fromNodeId: sim.currentNodeId, stepCount: sim.stepCount,
        },
        PAD: PADDING,
      });
      return;
    }

    const { edge, rule } = matched;
    dispatch({
      type: 'STEP',
      result: {
        halted: false,
        read, write: rule.write, direction: rule.direction,
        fromNodeId: sim.currentNodeId,
        toNodeId: edge.target,
        edgeId: edge.id,
        isAccept: edge._targetIsAccept,
        rule,
        stepCount: sim.stepCount + 1,
      },
      PAD: PADDING,
    });
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
    currentNodeId: sim.currentNodeId, activeEdgeId: sim.activeEdgeId, activeRead: sim.activeRead,
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

  const [converted, setConverted] = useState(null);
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    setConverted(null);
    setIsRendering(false);
    const timer = setTimeout(() => {
      const result = convertMultiToSingle(mtNodes, mtEdges);
      setConverted(result);
      setIsRendering(true); // graph data ready, now rendering starts
    }, 0);
    return () => clearTimeout(timer);
  }, [mtNodes, mtEdges]);

  const rawNodes = converted?.nodes ?? [];
  const rawEdges = converted?.edges ?? [];
  const isLoading = converted === null || isRendering;

  const sim = useDTMSimulation(rawNodes, rawEdges, mtEdges, defaultInput);

  // activeRead is the symbol read BEFORE the write — needed to match label.read in DraggableEdge
  const activeSymbol = sim.activeRead ?? null;

  const activeNodeLabel = useMemo(() => {
    const n = rawNodes.find(n => n.id === sim.currentNodeId);
    return n?.data?.label || sim.currentNodeId || '';
  }, [rawNodes, sim.currentNodeId]);

  const isAccepted = sim.status === 'ACCEPTED';
  const isRejected = sim.status === 'REJECTED';
  const isFinished = isAccepted || isRejected;
  const cardStatus = isAccepted ? 'accepted' : isRejected ? 'rejected' : 'active';
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

        {/* Loading overlay — shown while converting and rendering */}
        {isLoading && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            background: 'rgba(249,249,249,0.97)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 14, borderRadius: 10,
            fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
          }}>
            <style>{`@keyframes cdm-spin { to { transform: rotate(360deg); } }`}</style>
            <button onClick={onClose} style={{
              position: 'absolute', top: 10, right: 12,
              padding: '6px 13px', borderRadius: 6, cursor: 'pointer',
              background: 'transparent', border: '1px solid #ccc',
              fontSize: 20, lineHeight: 1, color: '#555',
            }}>×</button>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              border: '4px solid #eee', borderTopColor: '#e8d71a',
              animation: 'cdm-spin 0.8s linear infinite',
            }} />
            <div style={{ fontSize: 14, fontWeight: 500, color: '#555' }}>
              {converted === null ? 'Converting…' : 'Rendering…'}
            </div>
          </div>
        )}

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 18px', borderBottom: '1px solid #e0e0e0',
          background: '#fafafa', flexShrink: 0,
        }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: '#333' }}></span>
          <button onClick={onClose} style={{
            padding: '6px 13px', borderRadius: 6, cursor: 'pointer',
            background: 'transparent', border: '1px solid #ccc',
            fontSize: 20, lineHeight: 1, color: '#555',
          }}>×</button>
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
                <span className="thread-meta">Step: {sim.stepCount}</span>
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
              instantScroll={true} 
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
            {/* Strip transitions/animations — with 200+ states every border-color
                and stroke animation fires simultaneously per step, causing severe lag */}
            <style>{`
              .cdm-no-transition .node,
              .cdm-no-transition .node-ring,
              .cdm-no-transition .edge-path,
              .cdm-no-transition .react-flow__edge-path,
              .cdm-no-transition .react-flow__node,
              .cdm-no-transition .react-flow__handle,
              .cdm-no-transition svg path,
              .cdm-no-transition svg text {
                transition: none !important;
                animation: none !important;
              }
            `}</style>
            <div className="cdm-no-transition" style={{ width: '100%', height: '100%' }}>
              <ReactFlowProvider>
                <LiveDiagram
                  rawNodes={rawNodes}
                  rawEdges={rawEdges}
                  activeNodeId={sim.currentNodeId}
                  activeEdgeId={sim.activeEdgeId}
                  activeSymbol={activeSymbol}
                  stepCount={sim.stepCount}
                  onReady={() => setIsRendering(false)}
                />
              </ReactFlowProvider>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}