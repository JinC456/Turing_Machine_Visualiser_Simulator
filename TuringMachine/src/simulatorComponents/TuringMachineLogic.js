import { useState, useCallback } from 'react';
import { stepTM, getStartNode } from './engines/Deterministic'; 

export const useTuringMachine = (initialCells = 13) => {
  const initialHead = Math.floor(initialCells / 2);

  const [tape, setTape] = useState(Array(initialCells).fill(""));
  const [head, setHead] = useState(initialHead);
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [history, setHistory] = useState([]); 

  // REMOVED: The useEffect for expansion is gone.
  // Expansion is now handled proactively in stepForward.

  const reset = useCallback(() => {
    setTape(Array(initialCells).fill(""));
    setHead(initialHead);
    setActiveNodeId(null);
    setError(null);
    setSuccess(false);
    setHistory([]);
  }, [initialCells, initialHead]);

  const stepBack = useCallback(() => {
    setHistory(prev => {
      if (prev.length === 0) return prev;

      const previousState = prev[prev.length - 1];
      setTape(previousState.tape);
      setHead(previousState.head);
      setActiveNodeId(previousState.activeNodeId);
      setError(null);
      setSuccess(false);

      return prev.slice(0, -1);
    });
  }, []);

  const stepForward = useCallback((nodes, edges) => {
    if (error || success) return;

    let currentState = activeNodeId;

    // 1. Initialize Start Node if needed
    if (!currentState) {
      const startNode = getStartNode(nodes);
      if (!startNode) {
        setError("No Start Node");
        return;
      }
      currentState = startNode.id;
      setActiveNodeId(currentState);
    }

    // 2. Save History
    setHistory(prev => [
      ...prev,
      { tape: [...tape], head, activeNodeId: currentState }
    ]);

    // 3. Calculate Logic Step
    const result = stepTM({
      currentNodeId: currentState,
      tape,
      head,
      nodes,
      edges
    });

    if (result.halted) {
      setError(result.reason);
      return;
    }

    // 4. Calculate New State (Locally first)
    let newTape = [...tape];
    // Write value (handle * as blank)
    newTape[head] = result.write === '*' ? "" : result.write;

    let newHead = head;
    if (result.direction === "R") newHead++;
    if (result.direction === "L") newHead--;

    // 5. Handle Infinite Tape Expansion (Proactive)
    const edgeThreshold = 6;
    const expansionSize = 6;

    if (newHead < edgeThreshold) {
      // Expand Left
      const expansion = Array(expansionSize).fill("");
      newTape = [...expansion, ...newTape];
      // Shift head to account for new cells
      newHead += expansionSize;
    } 
    else if (newHead >= newTape.length - edgeThreshold) {
      // Expand Right
      const expansion = Array(expansionSize).fill("");
      newTape = [...newTape, ...expansion];
    }

    // 6. Update State Once
    setTape(newTape);
    setHead(newHead);
    setActiveNodeId(result.toNodeId);

    if (result.isAccept) {
      setSuccess(true);
    }
  }, [activeNodeId, error, success, tape, head]);

  return {
    tape,
    head,
    activeNodeId,
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