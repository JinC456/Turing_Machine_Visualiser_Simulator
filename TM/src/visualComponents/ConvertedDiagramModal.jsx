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

import { convertMultiToSingle } from '../simulatorComponents/engines/conversion/convertMultiToSingle';
import { convertToOneWay, buildOneWayTape } from '../simulatorComponents/engines/conversion/convertToOneWay';
import { convertNtmToDtm, buildNtmQueueTape } from '../simulatorComponents/engines/conversion/convertNtmToDtm';
import { getStartNode } from '../simulatorComponents/engines/Deterministic';
import { stepMultiTM } from '../simulatorComponents/engines/MultiTape';
import { MAX_RUN_STEPS_ONE_WAY, MAX_RUN_STEPS_SINGLE, MAX_RUN_STEPS_NTM } from '../simulatorComponents/TuringMachineLogic';
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

// ── NTM 3-tape constants ───────────────────────────────────────────────────
const NTM_NUM_TAPES = 3;
const NTM_TAPE_PADDING = 20;

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
// ── Auto-pan ───────────────────────────────────────────────────────────────
function useAutoPan(activeNodeId, stepCount) {
  // Note: We changed `setCenter` to `setViewport`
  const { getNodes, setViewport } = useReactFlow();

  useEffect(() => {
    if (!activeNodeId) return;
    const target = getNodes().find(n => n.id === activeNodeId);
    if (!target) return;

    // 1. Grab the main wrapper element of the graph
    const container = document.querySelector('.cdm-no-transition');
    if (!container) return;

    // 2. Find the exact center of the current active node
    const { x, y } = target.position;
    const w = target.width ?? 50;
    const h = target.height ?? 50;
    const nodeX = x + w / 2;
    const nodeY = y + h / 2;

    // 3. Get the container's bounds and screen space
    const rect = container.getBoundingClientRect();
    const fullWidth = container.clientWidth;
    const fullHeight = container.clientHeight;
    const windowHeight = window.innerHeight;

    // 4. Calculate the specific "Visible Slice" of the graph container
    let visibleTop = Math.max(0, -rect.top);
    let visibleBottom = Math.min(fullHeight, windowHeight - rect.top);

    // Fallback just in case the user scrolled the graph entirely off-screen
    if (visibleBottom <= visibleTop) {
      visibleTop = 0;
      visibleBottom = fullHeight;
    }

    // 5. Calculate the center of the visible area
    const visibleCenterX = fullWidth / 2;
    const visibleCenterY = (visibleTop + visibleBottom) / 2;

    // 6. Project the viewport so the node lands on our custom visible center
    const zoom = 1; 
    setViewport({
      x: visibleCenterX - (nodeX * zoom),
      y: visibleCenterY - (nodeY * zoom),
      zoom: zoom
    }, { duration: 0 });

  }, [activeNodeId, stepCount, getNodes, setViewport]);
}

// ── Live diagram (inside ReactFlowProvider) ────────────────────────────────
const BATCH_SIZE = 50;

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

  const [visibleCount, setVisibleCount] = useState(0);
  const isLoaded = visibleCount >= styledNodes.length;

  useEffect(() => {
    setVisibleCount(0);
  }, [styledNodes]);

  useEffect(() => {
    if (isLoaded) { onReady?.(); return; }
    const raf = requestAnimationFrame(() => {
      setVisibleCount(c => Math.min(c + BATCH_SIZE, styledNodes.length));
    });
    return () => cancelAnimationFrame(raf);
  }, [visibleCount, isLoaded, styledNodes.length, onReady]);

  const visibleNodes = useMemo(() => styledNodes.slice(0, visibleCount), [styledNodes, visibleCount]);
  const visibleEdges = isLoaded ? styledEdges : [];

  const [nodes, setNodes, onNodesChange] = useNodesState(visibleNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(visibleEdges);

  useEffect(() => { setNodes(visibleNodes); }, [visibleNodes, setNodes]);
  useEffect(() => { if (isLoaded) setEdges(styledEdges); }, [isLoaded, styledEdges, setEdges]);

  const prevNodeId = useRef(null);
  const prevEdgeId = useRef(null);
  const prevSymbol = useRef(null);

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

function simInitFromTape(rawNodes, tapeAndHead) {
  const startNode = getStartNode(rawNodes);
  if (!startNode) return null;
  return {
    tape: tapeAndHead.tape,
    head: tapeAndHead.head,
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
      if (newHead < 20) { 
        newTape.unshift(...Array(PAD).fill('\u2423')); 
        newHead += PAD; 
      }
      while (newHead >= newTape.length - 20) {
        newTape.push('\u2423');
      }
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

    case 'FLUSH':
      return { ...action.payload, history: [] };

    default: return state;
  }
}

function useDTMSimulation(rawNodes, rawEdges, mtEdges, initialInput, tapeBuilder = null, maxSteps = MAX_RUN_STEPS_SINGLE) {
  const [localInput, setLocalInput] = useState(initialInput || '');
  const [isRunning, setIsRunning]   = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [speed, setSpeed]           = useState(1);

  const [sim, dispatch] = useReducer(simReducer, null, () => ({
    tape: [], head: 0, currentNodeId: null, activeEdgeId: null,
    stepCount: 0, status: 'IDLE', statusMessage: 'Ready.', history: [],
  }));

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
    const payload = tapeBuilder
      ? simInitFromTape(rawNodes, tapeBuilder(localInput))
      : simInit(rawNodes, mtEdges, localInput);
    if (!payload) return;
    dispatch({ type: 'INIT', payload });
    setIsRunning(false);
  }, [rawNodes, mtEdges, localInput, tapeBuilder]);

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

  const runToEnd = useCallback(() => {
    if (sim.status === 'ACCEPTED' || sim.status === 'REJECTED') return;
    setIsRunning(false);
    setIsSkipping(true);

    const CHUNK = 2000; // steps per animation frame

    let curTape = [...sim.tape];
    let curHead = sim.head;
    let curNodeId = sim.currentNodeId;
    let curEdgeId = sim.activeEdgeId;
    let curRead = sim.activeRead;
    let curStep = sim.stepCount;
    let finalStatus = 'RUNNING';
    let finalMessage = sim.statusMessage;

    function runChunk() {
      let i = 0;
      while (i < CHUNK && finalStatus === 'RUNNING') {
        if (curStep >= maxSteps) {
          finalStatus = 'REJECTED';
          finalMessage = `Timeout: exceeded ${maxSteps.toLocaleString()} steps`;
          curEdgeId = null;
          break;
        }
        const outgoing = edgeIndex[curNodeId] || [];
        const read = curTape[curHead] || '\u2423';

        let matched = null;
        for (const edge of outgoing) {
          const rule = (edge.data?.labels || []).find(
            l => l.read === read || (l.read === '\u2423' && read === '')
          );
          if (rule) { matched = { edge, rule }; break; }
        }

        if (!matched) {
          finalStatus = 'REJECTED';
          finalMessage = 'Halted: No transition defined';
          curEdgeId = null;
          break;
        }

        const { edge, rule } = matched;
        curTape[curHead] = rule.write;
        let newHead = curHead;
        if (rule.direction === 'R') newHead++;
        if (rule.direction === 'L') newHead--;
        if (newHead < 20) {
          curTape.unshift(...Array(PADDING).fill('\u2423'));
          newHead += PADDING;
        }
        while (newHead >= curTape.length - 20) curTape.push('\u2423');

        curHead = newHead;
        curRead = read;
        curEdgeId = edge.id;
        curNodeId = edge.target;
        curStep++;

        if (edge._targetIsAccept) {
          finalStatus = 'ACCEPTED';
          finalMessage = 'ACCEPTED!';
          break;
        }
        i++;
      }

      if (finalStatus === 'RUNNING') {
        // Yield to the browser so the shimmer animation can paint, then continue
        setTimeout(runChunk, 0);
      } else {
        dispatch({
          type: 'FLUSH',
          payload: {
            tape: curTape,
            head: curHead,
            currentNodeId: curNodeId,
            activeEdgeId: curEdgeId,
            activeRead: curRead,
            stepCount: curStep,
            status: finalStatus,
            statusMessage: finalMessage,
          },
        });
        setIsSkipping(false);
      }
    }

    setTimeout(runChunk, 0);
  }, [sim, edgeIndex]);

  return {
    localInput, setLocalInput,
    tape: sim.tape, head: sim.head,
    currentNodeId: sim.currentNodeId, activeEdgeId: sim.activeEdgeId, activeRead: sim.activeRead,
    stepCount: sim.stepCount, status: sim.status, statusMessage: sim.statusMessage,
    isRunning, setIsRunning,
    isSkipping,
    speed, setSpeed,
    history: sim.history,
    initialize,
    undo: () => { dispatch({ type: 'UNDO' }); setIsRunning(false); },
    step,
    runToEnd,
    handleClear: () => setLocalInput(''),
  };
}

// ── 3-tape multi-tape DTM simulation (used for NTM mode) ──────────────────

function multiTapeSimReducer(state, action) {
  switch (action.type) {
    case 'INIT':
      return { ...action.payload, history: [] };

    case 'STEP': {
      const { result } = action;
      const snapshot = {
        tapes: state.tapes.map(t => [...t]),
        heads: [...state.heads],
        currentNodeId: state.currentNodeId,
        activeEdgeId: state.activeEdgeId,
        activeReads: state.activeReads,
        stepCount: state.stepCount,
        status: state.status,
        statusMessage: state.statusMessage,
      };

      if (result.halted) {
        return {
          ...state,
          status: 'REJECTED',
          statusMessage: `Halted: ${result.reason}`,
          activeEdgeId: null,
          activeReads: null,
          history: [...state.history, snapshot],
        };
      }

      const newTapes = state.tapes.map(t => [...t]);
      const newHeads = [...state.heads];
      const PAD = NTM_TAPE_PADDING;

      for (let i = 0; i < NTM_NUM_TAPES; i++) {
        newTapes[i][newHeads[i]] = result.writes[i];
        if (result.directions[i] === 'R') newHeads[i]++;
        if (result.directions[i] === 'L') newHeads[i]--;
        // Expand tape if head goes out of bounds
        if (newHeads[i] < 20) {
          newTapes[i].unshift(...Array(PAD).fill('␣'));
          newHeads[i] += PAD;
        }
        while (newHeads[i] >= newTapes[i].length - 20) {
          newTapes[i].push('␣');
        }
      }

      return {
        ...state,
        tapes: newTapes,
        heads: newHeads,
        currentNodeId: result.toNodeId,
        activeEdgeId: result.edgeId,
        activeReads: result.reads,
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

    case 'FLUSH':
      return { ...action.payload, history: [] };

    default:
      return state;
  }
}

function useNtmMultiTapeSimulation(rawNodes, rawEdges, initialInput, maxSteps = MAX_RUN_STEPS_NTM) {
  const [localInput, setLocalInput] = useState(initialInput || '');
  const [isRunning, setIsRunning]   = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [speed, setSpeed]           = useState(1);

  const [sim, dispatch] = useReducer(multiTapeSimReducer, null, () => {
    const blankTapes = Array.from({ length: NTM_NUM_TAPES }, () =>
      Array(NTM_TAPE_PADDING * 2).fill('␣')
    );
    return {
      tapes: blankTapes,
      heads: Array(NTM_NUM_TAPES).fill(NTM_TAPE_PADDING),
      currentNodeId: null,
      activeEdgeId: null,
      activeReads: null,
      stepCount: 0,
      status: 'IDLE',
      statusMessage: 'Ready.',
      history: [],
    };
  });

  // Build enriched edge index
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
    const startNode = getStartNode(rawNodes);
    if (!startNode) return;
    const { tapes, heads } = buildNtmQueueTape(localInput); // USE THE IMPORTED BUILDER
    dispatch({
      type: 'INIT',
      payload: {
        tapes,
        heads,
        currentNodeId: startNode.id,
        activeEdgeId: null,
        activeReads: null,
        stepCount: 0,
        status: 'IDLE',
        statusMessage: 'Initialized. Press Start or Step.',
      },
    });
    setIsRunning(false);
  }, [rawNodes, localInput]);

  useEffect(() => { initialize(); }, [initialize]);

  const step = useCallback(() => {
    if (sim.status === 'ACCEPTED' || sim.status === 'REJECTED') return;

    // stepMultiTM reads from the tapes using the heads
    const result = stepMultiTM({
      currentNodeId: sim.currentNodeId,
      tapes: sim.tapes,
      heads: sim.heads,
      nodes: rawNodes,
      edges: rawEdges,
      stepCount: sim.stepCount,
    });

    dispatch({ type: 'STEP', result });
  }, [sim, rawNodes, rawEdges]);

  useEffect(() => {
    if (!isRunning || sim.status === 'ACCEPTED' || sim.status === 'REJECTED') {
      if (sim.status === 'ACCEPTED' || sim.status === 'REJECTED') setIsRunning(false);
      return;
    }
    const interval = setInterval(step, 1000 / speed);
    return () => clearInterval(interval);
  }, [isRunning, step, speed, sim.status]);

  const runToEnd = useCallback(() => {
    if (sim.status === 'ACCEPTED' || sim.status === 'REJECTED') return;
    setIsRunning(false);
    setIsSkipping(true);

    const CHUNK = 2000;

    let curTapes = sim.tapes.map(t => [...t]);
    let curHeads = [...sim.heads];
    let curNodeId = sim.currentNodeId;
    let curEdgeId = sim.activeEdgeId;
    let curReads = sim.activeReads;
    let curStep = sim.stepCount;
    let finalStatus = 'RUNNING';
    let finalMessage = sim.statusMessage;
    const PAD = NTM_TAPE_PADDING;

    function runChunk() {
      let i = 0;
      while (i < CHUNK && finalStatus === 'RUNNING') {
        if (curStep >= maxSteps) {
          finalStatus = 'REJECTED';
          finalMessage = `Timeout: exceeded ${maxSteps.toLocaleString()} steps`;
          curEdgeId = null;
          break;
        }
        const result = stepMultiTM({
          currentNodeId: curNodeId,
          tapes: curTapes,
          heads: curHeads,
          nodes: rawNodes,
          edges: rawEdges,
          stepCount: curStep,
        });

        if (result.halted) {
          finalStatus = 'REJECTED';
          finalMessage = `Halted: ${result.reason}`;
          curEdgeId = null;
          break;
        }

        for (let t = 0; t < NTM_NUM_TAPES; t++) {
          curTapes[t][curHeads[t]] = result.writes[t];
          if (result.directions[t] === 'R') curHeads[t]++;
          if (result.directions[t] === 'L') curHeads[t]--;
          if (curHeads[t] < 20) {
            curTapes[t].unshift(...Array(PAD).fill('␣'));
            curHeads[t] += PAD;
          }
          while (curHeads[t] >= curTapes[t].length - 20) curTapes[t].push('␣');
        }

        curReads = result.reads;
        curEdgeId = result.edgeId;
        curNodeId = result.toNodeId;
        curStep = result.stepCount;

        if (result.isAccept) {
          finalStatus = 'ACCEPTED';
          finalMessage = 'ACCEPTED!';
          break;
        }
        i++;
      }

      if (finalStatus === 'RUNNING') {
        setTimeout(runChunk, 0);
      } else {
        dispatch({
          type: 'FLUSH',
          payload: {
            tapes: curTapes,
            heads: curHeads,
            currentNodeId: curNodeId,
            activeEdgeId: curEdgeId,
            activeReads: curReads,
            stepCount: curStep,
            status: finalStatus,
            statusMessage: finalMessage,
          },
        });
        setIsSkipping(false);
      }
    }

    setTimeout(runChunk, 0);
  }, [sim, rawNodes, rawEdges]);

  return {
    localInput, setLocalInput,
    // Expose a unified `tape` / `head` for display — but also expose all tapes
    tapes: sim.tapes,
    heads: sim.heads,
    // Single-tape compat shim: show tape 1 as the "primary" tape in the shared TapeDisplay
    tape: sim.tapes[0] ?? [],
    head: sim.heads[0] ?? 0,
    currentNodeId: sim.currentNodeId,
    activeEdgeId: sim.activeEdgeId,
    activeReads: sim.activeReads,
    stepCount: sim.stepCount,
    status: sim.status,
    statusMessage: sim.statusMessage,
    isRunning, setIsRunning,
    isSkipping,
    speed, setSpeed,
    history: sim.history,
    initialize,
    undo: () => { dispatch({ type: 'UNDO' }); setIsRunning(false); },
    step,
    runToEnd,
    handleClear: () => setLocalInput(''),
  };
}



// ── Main modal ─────────────────────────────────────────────────────────────
export default function ConvertedDiagramModal({ nodes: mtNodes, edges: mtEdges, onClose, mode = 'singleTape', validAlphabet }) {
  const defaultInput = mtNodes.find(n => n.type === 'start')?.data?.input || '';

  const [converted, setConverted] = useState(null);
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    setConverted(null);
    setIsRendering(false);
    const timer = setTimeout(() => {
      let result;
      if (mode === 'oneWay') {
        result = convertToOneWay(mtNodes, mtEdges);
      } else if (mode === 'ntm') {
        result = convertNtmToDtm(mtNodes, mtEdges);
      } else {
        result = convertMultiToSingle(mtNodes, mtEdges);
      }
      setConverted(result);
      setIsRendering(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [mtNodes, mtEdges, mode]);

  const rawNodes = converted?.nodes ?? [];
  const rawEdges = converted?.edges ?? [];
  const isLoading = converted === null || isRendering;

  // ── Single-tape sim (singleTape + oneWay modes) ──────────────────────────
  const singleSim = useDTMSimulation(
    rawNodes, rawEdges,
    mode === 'ntm' || mode === 'oneWay' ? null : mtEdges,
    defaultInput,
    mode === 'oneWay' ? buildOneWayTape : null,
    mode === 'oneWay' ? MAX_RUN_STEPS_ONE_WAY : MAX_RUN_STEPS_SINGLE,
  );

  // ── 3-tape sim (ntm mode) ────────────────────────────────────────────────
  const multiSim = useNtmMultiTapeSimulation(
    rawNodes, rawEdges,
    defaultInput,
    MAX_RUN_STEPS_NTM,
  );

  // Select the active sim based on mode
  const sim = mode === 'ntm' ? multiSim : singleSim;

  // activeRead for edge highlighting
  // Single-tape: sim.activeRead (scalar). Multi-tape: sim.activeReads[0] (tape 1 symbol).
  const activeSymbol = mode === 'ntm'
    ? (sim.activeReads?.[0] ?? null)
    : (sim.activeRead ?? null);

  const activeNodeLabel = useMemo(() => {
    const n = rawNodes.find(n => n.id === sim.currentNodeId);
    return n?.data?.label || sim.currentNodeId || '';
  }, [rawNodes, sim.currentNodeId]);

  // ── Input alphabet validation ─────────────────────────────────────────────
  const [inputError, setInputError] = useState(null);

  useEffect(() => {
    if (!validAlphabet || validAlphabet.size === 0) {
      setInputError(null);
      return;
    }
    const invalidChars = [...(sim.localInput || '')].filter(ch => !validAlphabet.has(ch));
    if (invalidChars.length > 0) {
      const unique = [...new Set(invalidChars)];
      setInputError(`Invalid character${unique.length > 1 ? 's' : ''}: ${unique.map(c => `"${c}"`).join(', ')}`);
    } else {
      setInputError(null);
    }
  }, [sim.localInput, validAlphabet]);

  const isAccepted = sim.status === 'ACCEPTED';
  const isRejected = sim.status === 'REJECTED';
  const isFinished = isAccepted || isRejected;
  const cardStatus  = isAccepted ? 'accepted' : isRejected ? 'rejected' : 'active';
  const badgeLabel  = isAccepted ? '✔ ACCEPTED' : isRejected ? '✖ REJECTED' : sim.isRunning ? '● RUNNING' : 'READY';

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
        overflow: mode === 'ntm' ? 'auto' : 'hidden',
        boxShadow: '0 8px 40px rgba(0,0,0,0.45)',
      }}>

        {/* Loading overlay */}
        {isLoading && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            background: 'rgba(249,249,249,0.97)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 14, borderRadius: 10,
            fontFamily: 'Verdana',
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

        {/* Header */}
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

        {/* Controls + tape area */}
        <div style={{
          flexShrink: 0, borderBottom: '2px solid #e0e0e0',
          padding: '12px 18px 10px', background: '#fdfdfd',
          display: 'flex', flexDirection: 'column', gap: 10,

        }}>
          {/* ── NTM: one card per tape, matching TapeContainer's multi-tape layout ── */}
          {mode === 'ntm' ? (
            <div className="thread-list-container" style={{ border: 'none', gap: 12, padding: 0, width: '100%', maxWidth: 'none', overflow: 'visible' }}>
              {sim.tapes.map((tape, index) => (
                <div key={index} className="thread-tree-row" style={{ width: '100%' }}>
                  <div className={`thread-card ${cardStatus} tree-card`} style={{ width: '100%', marginTop: 0 }}>
                    <div className="thread-header">
                      <div className="thread-id-info">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: '#e8d71a', border: '1px solid rgba(0,0,0,0.1)' }} />
                          <span className="thread-name">Tape {index + 1}</span>
                        </div>
                        <span className="thread-meta">(Step {sim.stepCount})</span>
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
                      tape={tape}
                      head={sim.heads[index]}
                      activeLabel={activeNodeLabel}
                      cellSize={CELL_SIZE}
                      width="100%"
                      instantScroll={true}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ── Single / one-way: one card ── */
            <div className={`thread-card ${cardStatus} tree-card`} style={{ width: '100%', marginTop: 0 }}>
              <div className="thread-header">
                <div className="thread-id-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: '#333', border: '1px solid rgba(0,0,0,0.1)' }} />
                    <span className="thread-name">
                      {mode === 'oneWay' ? 'One-Way Tape Equivalent' : 'Sipser Single-Tape Equivalent'}
                    </span>
                  </div>
                  <span className="thread-meta">Step: {sim.stepCount}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {mode === 'oneWay' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.72rem', color: '#666' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 18, height: 12, borderRadius: 3, backgroundColor: 'rgba(166, 253, 147, 0.35)', border: '1px solid rgba(0,0,0,0.15)' }} />
                        <span>Right</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 18, height: 12, borderRadius: 3, backgroundColor: 'rgba(249, 254, 180, 0.35)', border: '1px solid rgba(0,0,0,0.15)' }} />
                        <span>Left</span>
                      </div>
                    </div>
                  )}
                  <span
                    className={`thread-status-badge ${cardStatus}`}
                    onClick={() => isRejected && alert(sim.statusMessage)}
                    title={isRejected ? 'Click to see reason' : ''}
                    style={{ cursor: isRejected ? 'pointer' : 'default' }}
                  >
                    {badgeLabel}
                  </span>
                </div>
              </div>
              <TapeDisplay
                tape={sim.tape}
                head={sim.head}
                activeLabel={activeNodeLabel}
                cellSize={CELL_SIZE}
                width="100%"
                instantScroll={true}
                oneWayColours={mode === 'oneWay'}
              />
            </div>
          )}

          {/* Input + playback */}
          <div style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            gap: 22, flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontWeight: 500, color: '#555', fontSize: 13 }}>Input:</label>
              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                {inputError && (
                  <div className="input-error-bubble">
                    {inputError}
                    <span className="input-error-bubble-tail" />
                  </div>
                )}
                <input
                  type="text"
                  value={sim.localInput}
                  onChange={e => sim.setLocalInput(e.target.value)}
                  disabled={sim.isRunning}
                  style={{
                    padding: '5px 8px', borderRadius: 4,
                    border: inputError ? '1.5px solid #d9534f' : '1px solid #ccc',
                    fontSize: 13, width: 160, fontFamily: 'monospace',
                    background: inputError ? '#fff5f5' : undefined,
                    outline: inputError ? 'none' : undefined,
                  }}
                />
              </div>
            </div>

            <PlaybackControls
              onStepForward={() => { if (!inputError) sim.step(); }}
              onStart={() => { if (!inputError) sim.setIsRunning(true); }}
              onStop={() => sim.setIsRunning(false)}
              onSkipToStart={sim.initialize}
              onSkipToEnd={() => { if (!inputError) sim.runToEnd(); }}
              onClear={sim.handleClear}
              onStepBack={sim.undo}
              isRunning={sim.isRunning}
              isFinished={isFinished}
              canUndo={sim.history.length > 0}
              isSkipping={sim.isSkipping}
            />

            <div className="speed-control" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <label>Speed: {sim.speed}x</label>
              <input
                type="range" min="0.25" max="3" step="0.25"
                value={sim.speed}
                onChange={e => sim.setSpeed(Number(e.target.value))}
              />

            </div>
          </div>
        </div>

        {/* Graph */}
        <div style={{ flex: 1, minHeight: mode === 'ntm' ? '70vh' : 0, display: 'flex', flexDirection: 'column' }}>
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