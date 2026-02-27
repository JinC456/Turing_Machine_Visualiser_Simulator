/* src/simulatorComponents/TuringMachineLogic.js */
import { useState, useCallback } from 'react';
import { stepTM, getStartNode } from './engines/Deterministic';
import { stepMultiTM } from './engines/MultiTape';
import { stepNonDeterministicTM, generateThreadColor } from './engines/NonDeterministic';

export const MAX_RUN_STEPS = 200;

// ─────────────────────────────────────────────────────────────────────────────
// Pure "run to end" helpers — no hooks, just logic.
// TapeContainer calls these and then uses flushRunToEnd() to update state.
// ─────────────────────────────────────────────────────────────────────────────

export function computeRunToEnd({ tape, head, activeNodeId, activeEdgeId, lastRead, stepCount, nodes, edges }) {
  const startNode = getStartNode(nodes);
  if (!startNode) return { error: "No Start Node" };

  let curTape = [...tape];
  let curHead = head;
  let curNodeId = activeNodeId || startNode.id;
  let curStep = stepCount;
  let halted = false;
  let accepted = false;
  let haltReason = null;
  let curEdgeId = activeEdgeId;
  let curLastRead = lastRead;

  while (!halted && curStep < MAX_RUN_STEPS) {
    const result = stepTM({ currentNodeId: curNodeId, tape: curTape, head: curHead, nodes, edges, stepCount: curStep });

    if (result.halted) {
      haltReason = result.reason;
      curStep = result.stepCount || curStep;
      halted = true;
      break;
    }

    curTape[curHead] = result.write;
    let newHead = curHead;
    if (result.direction === "R") newHead++;
    if (result.direction === "L") newHead--;

    const edgeThreshold = 15, expansionSize = 25;
    if (newHead < edgeThreshold) {
      curTape = [...Array(expansionSize).fill("␣"), ...curTape];
      newHead += expansionSize;
    } else if (newHead >= curTape.length - edgeThreshold) {
      curTape = [...curTape, ...Array(expansionSize).fill("␣")];
    }

    curHead = newHead;
    curNodeId = result.toNodeId;
    curEdgeId = result.edgeId;
    curLastRead = result.read;
    curStep = result.stepCount;

    if (result.isAccept) { accepted = true; halted = true; break; }
  }

  const timedOut = !halted && curStep >= MAX_RUN_STEPS;
  return {
    tape: curTape, head: curHead, activeNodeId: curNodeId, activeEdgeId: curEdgeId,
    lastRead: curLastRead, stepCount: curStep, success: accepted,
    error: haltReason || (timedOut ? "Timeout: max steps reached" : null),
  };
}

export function computeMultiRunToEnd({ tapes, heads, activeNodeId, activeEdgeId, lastRead, stepCount, numTapes, nodes, edges }) {
  const startNode = getStartNode(nodes);
  if (!startNode) return { error: "No Start Node" };

  let curTapes = tapes.map(t => [...t]);
  let curHeads = [...heads];
  let curNodeId = activeNodeId || startNode.id;
  let curStep = stepCount;
  let halted = false;
  let accepted = false;
  let haltReason = null;
  let curEdgeId = activeEdgeId;
  let curLastRead = lastRead;

  while (!halted && curStep < MAX_RUN_STEPS) {
    const result = stepMultiTM({ currentNodeId: curNodeId, tapes: curTapes, heads: curHeads, nodes, edges, stepCount: curStep });

    if (result.halted) {
      haltReason = result.reason;
      curStep = result.stepCount || curStep;
      halted = true;
      break;
    }

    for (let i = 0; i < numTapes; i++) {
      curTapes[i][curHeads[i]] = result.writes[i];
      if (result.directions[i] === "R") curHeads[i]++;
      if (result.directions[i] === "L") curHeads[i]--;

      const edgeThreshold = 6, expansionSize = 6;
      if (curHeads[i] < edgeThreshold) {
        curTapes[i] = [...Array(expansionSize).fill("␣"), ...curTapes[i]];
        curHeads[i] += expansionSize;
      } else if (curHeads[i] >= curTapes[i].length - edgeThreshold) {
        curTapes[i] = [...curTapes[i], ...Array(expansionSize).fill("␣")];
      }
    }

    curNodeId = result.toNodeId;
    curEdgeId = result.edgeId;
    curLastRead = result.reads;
    curStep = result.stepCount;

    if (result.isAccept) { accepted = true; halted = true; break; }
  }

  const timedOut = !halted && curStep >= MAX_RUN_STEPS;
  return {
    tapes: curTapes, heads: curHeads, activeNodeId: curNodeId, activeEdgeId: curEdgeId,
    lastRead: curLastRead, stepCount: curStep, success: accepted,
    error: haltReason || (timedOut ? "Timeout: max steps reached" : null),
  };
}

export function computeNonDetRunToEnd({ threads, stepCount, nodes, edges }) {
  const startNode = nodes.find(n => n.type === "start") || null;
  if (!startNode) {
    return { threads: threads.map(t => ({ ...t, status: 'rejected', reason: "No Start Node" })), stepCount, success: false };
  }

  let curThreads = threads;
  let curStep = stepCount;
  let globalAccept = false;

  if (curStep === 0 && curThreads.length > 0 && curThreads[0].currentNodeId === null) {
    curThreads = [{ ...curThreads[0], currentNodeId: startNode.id }];
  }

  while (curStep < MAX_RUN_STEPS) {
    const activeCount = curThreads.filter(t => t.status === 'active').length;
    if (activeCount === 0) break;

    const result = stepNonDeterministicTM({ threads: curThreads, nodes, edges });
    curThreads = result.threads;
    curStep++;
    if (result.globalAccept) { globalAccept = true; break; }
  }

  return { threads: curThreads, stepCount: curStep, success: globalAccept };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hooks — IDENTICAL hook counts to the original. No new hooks added.
// Each hook exposes flushRunToEnd() so TapeContainer can apply the pure
// helper results above without touching the hook internals.
// ─────────────────────────────────────────────────────────────────────────────

export const useTuringMachine = (initialCells = 13) => {
  const initialHead = Math.floor(initialCells / 2);

  const [tape, setTape] = useState(Array(initialCells).fill("␣"));
  const [head, setHead] = useState(initialHead);
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [activeEdgeId, setActiveEdgeId] = useState(null);
  const [lastRead, setLastRead] = useState(null);
  const [stepCount, setStepCount] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [history, setHistory] = useState([]);

  const reset = useCallback(() => {
    setTape(Array(initialCells).fill("␣"));
    setHead(initialHead);
    setActiveNodeId(null);
    setActiveEdgeId(null);
    setLastRead(null);
    setStepCount(0);
    setError(null);
    setSuccess(false);
    setHistory([]);
  }, [initialCells, initialHead]);

  const stepBack = useCallback(() => {
    setHistory(prev => {
      if (prev.length === 0) return prev;
      const previous = prev[prev.length - 1];
      setTape(previous.tape);
      setHead(previous.head);
      setActiveNodeId(previous.activeNodeId);
      setActiveEdgeId(previous.activeEdgeId);
      setLastRead(previous.lastRead);
      setStepCount(previous.stepCount);
      setError(null);
      setSuccess(false);
      return prev.slice(0, -1);
    });
  }, []);

  const stepForward = useCallback((nodes, edges) => {
    if (error || success) return;

    let currentState = activeNodeId;

    if (!currentState) {
      const startNode = getStartNode(nodes);
      if (!startNode) { setError("No Start Node"); return; }
      setHistory(prev => [...prev, { tape: [...tape], head, activeNodeId: null, activeEdgeId: null, lastRead: null, stepCount }]);
      setActiveNodeId(startNode.id);
      return;
    }

    const result = stepTM({ currentNodeId: currentState, tape, head, nodes, edges, stepCount });

    if (result.halted) {
      setActiveEdgeId(null);
      setError(result.reason);
      setStepCount(result.stepCount || stepCount);
      return;
    }

    setHistory(prev => [...prev, { tape: [...tape], head, activeNodeId: currentState, activeEdgeId, lastRead, stepCount }]);

    let newTape = [...tape];
    newTape[head] = result.write;
    let newHead = head;
    if (result.direction === "R") newHead++;
    if (result.direction === "L") newHead--;

    const edgeThreshold = 15, expansionSize = 25;
    if (newHead < edgeThreshold) {
      newTape = [...Array(expansionSize).fill("␣"), ...newTape];
      newHead += expansionSize;
    } else if (newHead >= newTape.length - edgeThreshold) {
      newTape = [...newTape, ...Array(expansionSize).fill("␣")];
    }

    setTape(newTape);
    setHead(newHead);
    setActiveNodeId(result.toNodeId);
    setActiveEdgeId(result.edgeId);
    setLastRead(result.read);
    setStepCount(result.stepCount);
    if (result.isAccept) setSuccess(true);
  }, [activeNodeId, activeEdgeId, error, success, tape, head, lastRead, stepCount]);

  const flushRunToEnd = useCallback((result) => {
    setTape(result.tape);
    setHead(result.head);
    setActiveNodeId(result.activeNodeId);
    setActiveEdgeId(result.activeEdgeId);
    setLastRead(result.lastRead);
    setStepCount(result.stepCount);
    setHistory([]);
    if (result.success) setSuccess(true);
    else if (result.error) setError(result.error);
  }, []);

  return {
    tape, head, activeNodeId, activeEdgeId, lastRead, stepCount, error, success,
    setTape, setHead, stepForward, stepBack, reset, flushRunToEnd,
    canUndo: history.length > 0
  };
};

export const useMultiTapeTuringMachine = (initialCells = 13, numTapes = 2) => {
  const initialHead = Math.floor(initialCells / 2);

  const [tapes, setTapes] = useState(Array.from({ length: numTapes }, () => Array(initialCells).fill("␣")));
  const [heads, setHeads] = useState(Array(numTapes).fill(initialHead));
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [activeEdgeId, setActiveEdgeId] = useState(null);
  const [lastRead, setLastRead] = useState(Array(numTapes).fill(null));
  const [stepCount, setStepCount] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [history, setHistory] = useState([]);

  const reset = useCallback(() => {
    setTapes(Array.from({ length: numTapes }, () => Array(initialCells).fill("␣")));
    setHeads(Array(numTapes).fill(initialHead));
    setActiveNodeId(null);
    setActiveEdgeId(null);
    setLastRead(Array(numTapes).fill(null));
    setStepCount(0);
    setError(null);
    setSuccess(false);
    setHistory([]);
  }, [initialCells, initialHead, numTapes]);

  const stepBack = useCallback(() => {
    setHistory(prev => {
      if (prev.length === 0) return prev;
      const previous = prev[prev.length - 1];
      setTapes(previous.tapes);
      setHeads(previous.heads);
      setActiveNodeId(previous.activeNodeId);
      setActiveEdgeId(previous.activeEdgeId);
      setLastRead(previous.lastRead);
      setStepCount(previous.stepCount);
      setError(null);
      setSuccess(false);
      return prev.slice(0, -1);
    });
  }, []);

  const stepForward = useCallback((nodes, edges) => {
    if (error || success) return;

    let currentState = activeNodeId;

    if (!currentState) {
      const startNode = getStartNode(nodes);
      if (!startNode) { setError("No Start Node"); return; }
      setHistory(prev => [...prev, { tapes: tapes.map(t => [...t]), heads: [...heads], activeNodeId: null, activeEdgeId: null, lastRead: Array(numTapes).fill(null), stepCount }]);
      setActiveNodeId(startNode.id);
      return;
    }

    const result = stepMultiTM({ currentNodeId: currentState, tapes, heads, nodes, edges, stepCount });

    if (result.halted) {
      setActiveEdgeId(null);
      setError(result.reason);
      setStepCount(result.stepCount || stepCount);
      return;
    }

    setHistory(prev => [...prev, { tapes: tapes.map(t => [...t]), heads: [...heads], activeNodeId: currentState, activeEdgeId, lastRead, stepCount }]);

    const newTapes = tapes.map(t => [...t]);
    const newHeads = [...heads];

    for (let i = 0; i < numTapes; i++) {
      newTapes[i][newHeads[i]] = result.writes[i];
      if (result.directions[i] === "R") newHeads[i]++;
      if (result.directions[i] === "L") newHeads[i]--;

      const edgeThreshold = 6, expansionSize = 6;
      if (newHeads[i] < edgeThreshold) {
        newTapes[i] = [...Array(expansionSize).fill("␣"), ...newTapes[i]];
        newHeads[i] += expansionSize;
      } else if (newHeads[i] >= newTapes[i].length - edgeThreshold) {
        newTapes[i] = [...newTapes[i], ...Array(expansionSize).fill("␣")];
      }
    }

    setTapes(newTapes);
    setHeads(newHeads);
    setActiveNodeId(result.toNodeId);
    setActiveEdgeId(result.edgeId);
    setLastRead(result.reads);
    setStepCount(result.stepCount);
    if (result.isAccept) setSuccess(true);
  }, [activeNodeId, activeEdgeId, error, success, tapes, heads, lastRead, stepCount, numTapes]);

  const flushRunToEnd = useCallback((result) => {
    setTapes(result.tapes);
    setHeads(result.heads);
    setActiveNodeId(result.activeNodeId);
    setActiveEdgeId(result.activeEdgeId);
    setLastRead(result.lastRead);
    setStepCount(result.stepCount);
    setHistory([]);
    if (result.success) setSuccess(true);
    else if (result.error) setError(result.error);
  }, []);

  return {
    tapes, heads, activeNodeId, activeEdgeId, lastRead, stepCount, error, success,
    setTapes, setHeads, stepForward, stepBack, reset, flushRunToEnd,
    canUndo: history.length > 0
  };
};

export const useNonDeterministicTM = (initialCells = 13) => {
  const initialHead = Math.floor(initialCells / 2);

  const [threads, setThreads] = useState([]);
  const [stepCount, setStepCount] = useState(0);
  const [success, setSuccess] = useState(false);
  const [history, setHistory] = useState([]);

  const setInitialThread = useCallback((inputTape, startHead) => {
    setThreads([{
      id: "1", tape: [...inputTape], head: startHead, currentNodeId: null,
      status: "active", stepCount: 0, history: [], color: generateThreadColor("1")
    }]);
    setSuccess(false);
    setStepCount(0);
    setHistory([]);
  }, []);

  const stepForward = useCallback((nodes, edges) => {
    if (success) return;

    setHistory(prev => [...prev, { threads, stepCount, success }]);

    let currentThreads = threads;
    const startNode = nodes.find(n => n.type === "start") || null;

    if (stepCount === 0 && threads.length > 0 && threads[0].currentNodeId === null) {
      if (!startNode) {
        setThreads(prev => prev.map(t => ({ ...t, status: 'rejected', reason: "No Start Node" })));
        return;
      }
      currentThreads = [{ ...threads[0], currentNodeId: startNode.id }];
    }

    const { threads: nextThreads, globalAccept } = stepNonDeterministicTM({ threads: currentThreads, nodes, edges });
    setThreads(nextThreads);
    setStepCount(c => c + 1);
    if (globalAccept) setSuccess(true);
  }, [threads, stepCount, success]);

  const stepBack = useCallback(() => {
    setHistory(prev => {
      if (prev.length === 0) return prev;
      const previous = prev[prev.length - 1];
      setThreads(previous.threads);
      setStepCount(previous.stepCount);
      setSuccess(previous.success);
      return prev.slice(0, -1);
    });
  }, []);

  const reset = useCallback(() => {
    setThreads([]);
    setStepCount(0);
    setSuccess(false);
    setHistory([]);
  }, []);

  const flushRunToEnd = useCallback((result) => {
    setThreads(result.threads);
    setStepCount(result.stepCount);
    setHistory([]);
    if (result.success) setSuccess(true);
  }, []);

  return {
    threads, setInitialThread, stepForward, stepBack, reset, flushRunToEnd,
    canUndo: history.length > 0, success, stepCount
  };
};