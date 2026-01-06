import { useState, useCallback } from 'react';
import { stepTM, getStartNode } from './engines/Deterministic'; 

export const useTuringMachine = (initialCells = 13) => {
  const initialHead = Math.floor(initialCells / 2);

  const [tape, setTape] = useState(Array(initialCells).fill(""));
  const [head, setHead] = useState(initialHead);

  const [activeNodeId, setActiveNodeId] = useState(null);
  const [activeEdgeId, setActiveEdgeId] = useState(null);
  const [lastRead, setLastRead] = useState(null);
  
  // Track step count to force UI updates/animations
  const [stepCount, setStepCount] = useState(0);

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const [history, setHistory] = useState([]);

  // --- RESET ---
  const reset = useCallback(() => {
    setTape(Array(initialCells).fill(""));
    setHead(initialHead);
    setActiveNodeId(null);
    setActiveEdgeId(null);
    setLastRead(null);
    setStepCount(0);
    setError(null);
    setSuccess(false);
    setHistory([]);
  }, [initialCells, initialHead]);

  // --- STEP BACK ---
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

  // --- STEP FORWARD ---
  const stepForward = useCallback((nodes, edges) => {
    if (error || success) return;

    let currentState = activeNodeId;

    // First step → find start node
    if (!currentState) {
      const startNode = getStartNode(nodes);
      if (!startNode) {
        setError("No Start Node");
        return;
      }
      currentState = startNode.id;
      setActiveNodeId(currentState);
    }

    // Save history BEFORE executing transition
    setHistory(prev => [
      ...prev,
      {
        tape: [...tape],
        head,
        activeNodeId: currentState,
        activeEdgeId,
        lastRead,
        stepCount
      }
    ]);

    const result = stepTM({
      currentNodeId: currentState,
      tape,
      head,
      nodes,
      edges
    });

    if (result.halted) {
      setActiveEdgeId(null);
      setError(result.reason);
      return;
    }

    // --- WRITE & MOVE ---
    let newTape = [...tape];
    newTape[head] = result.write === '*' ? "" : result.write;

    let newHead = head;
    if (result.direction === "R") newHead++;
    if (result.direction === "L") newHead--;

    // --- EXPANSION ---
    const edgeThreshold = 6;
    const expansionSize = 6;
    if (newHead < edgeThreshold) {
      const expansion = Array(expansionSize).fill("");
      newTape = [...expansion, ...newTape];
      newHead += expansionSize;
    } else if (newHead >= newTape.length - edgeThreshold) {
      const expansion = Array(expansionSize).fill("");
      newTape = [...newTape, ...expansion];
    }

    // --- UPDATE STATE ---
    setTape(newTape);
    setHead(newHead);
    setActiveNodeId(result.toNodeId);
    setActiveEdgeId(result.edgeId);
    setLastRead(result.read);
    setStepCount(c => c + 1);

    if (result.isAccept) {
      setSuccess(true);
    }
  }, [activeNodeId, activeEdgeId, error, success, tape, head, lastRead, stepCount]);

  return {
    tape,
    head,
    activeNodeId,
    activeEdgeId,
    lastRead,
    stepCount,
    error,
    success,
    setTape,
    setHead,
    stepForward,
    stepBack,
    reset,
    canUndo: history.length > 0
  };
};