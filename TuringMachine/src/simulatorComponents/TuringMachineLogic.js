import { useState, useCallback, useRef } from 'react';
import { stepTM, getStartNode } from './engines/Deterministic';

export const turingMachine = (initialCells = 13) => {
  const initialHead = Math.floor(initialCells / 2);


  const [tape, setTape] = useState(Array(initialCells).fill(""));
  const [head, setHead] = useState(initialHead);
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  const [history, setHistory] = useState([]); 

  const reset = useCallback(() => {
    setTape(Array(initialCells).fill(""));
    setHead(initialHead);
    setActiveNodeId(null);
    setError(null);
    setSuccess(false);
    setHistory([]);
  }, [initialCells, initialHead]);

  const stepBack = useCallback(() => {
    if (history.length === 0) return;

    const previousState = history[history.length - 1];

    setTape(previousState.tape);
    setHead(previousState.head);
    setActiveNodeId(previousState.activeNodeId);
    setError(null);
    setSuccess(false);

    setHistory(prev => prev.slice(0, -1));
  }, [history]);

  const stepForward = useCallback((nodes, edges) => {
    if (error || success) return;

    let currentState = activeNodeId;
    if (!currentState) {
      const startNode = getStartNode(nodes);
      if (!startNode) {
        setError("No Start Node");
        return;
      }
      currentState = startNode.id;
      setActiveNodeId(currentState);
      return; 
    }

    setHistory(prev => [...prev, { tape: [...tape], head, activeNodeId: currentState }]);

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

    const newTape = [...tape];
    newTape[head] = result.write;
    setTape(newTape);

    if (result.direction === "R") setHead(h => h + 1);
    if (result.direction === "L") setHead(h => h - 1);

    setActiveNodeId(result.toNodeId);

    if (result.isAccept) {
      setSuccess(true);
    }
  }, [activeNodeId, tape, head, error, success]);

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