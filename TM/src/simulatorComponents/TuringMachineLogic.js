/* src/simulatorComponents/TuringMachineLogic.js */
import { useState, useCallback } from 'react';
import { stepTM, getStartNode } from './engines/Deterministic';
import { stepMultiTM } from './engines/MultiTape';
import { stepNonDeterministicTM, generateThreadColor } from './engines/NonDeterministic';

// --- Single Tape Hook (Deterministic) ---
export const useTuringMachine = (initialCells = 13) => {
  const initialHead = Math.floor(initialCells / 2);

  const [tape, setTape] = useState(Array(initialCells).fill(""));
  const [head, setHead] = useState(initialHead);

  const [activeNodeId, setActiveNodeId] = useState(null);
  const [activeEdgeId, setActiveEdgeId] = useState(null);
  const [lastRead, setLastRead] = useState(null);

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

    if (!currentState) {
      const startNode = getStartNode(nodes);
      if (!startNode) {
        setError("No Start Node");
        return;
      }
      
      setHistory(prev => [
        ...prev,
        {
          tape: [...tape],
          head,
          activeNodeId: null, 
          activeEdgeId: null,
          lastRead: null,
          stepCount
        }
      ]);

      currentState = startNode.id;
      setActiveNodeId(currentState);
      return;
    }

    const result = stepTM({
      currentNodeId: currentState,
      tape,
      head,
      nodes,
      edges,
      stepCount // Pass current count to engine
    });

    if (result.halted) {
      setActiveEdgeId(null);
      setError(result.reason);
      setStepCount(result.stepCount || stepCount);
      return;
    }

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

    let newTape = [...tape];
    newTape[head] = result.write === "␣" ? "" : result.write;

    let newHead = head;
    if (result.direction === "R") newHead++;
    if (result.direction === "L") newHead--;

    const edgeThreshold = 15;
    const expansionSize = 25;

    if (newHead < edgeThreshold) {
      const expansion = Array(expansionSize).fill("");
      newTape = [...expansion, ...newTape];
      newHead += expansionSize;
    } else if (newHead >= newTape.length - edgeThreshold) {
      const expansion = Array(expansionSize).fill("");
      newTape = [...newTape, ...expansion];
    }

    setTape(newTape);
    setHead(newHead);
    setActiveNodeId(result.toNodeId);
    setActiveEdgeId(result.edgeId);
    setLastRead(result.read);
    setStepCount(result.stepCount); // Use incremented count from engine

    if (result.isAccept) {
      setSuccess(true);
      return;
    }
  }, [activeNodeId, activeEdgeId, error, success, tape, head, lastRead, stepCount]);

  return {
    tape, head, activeNodeId, activeEdgeId, lastRead, stepCount, error, success,
    setTape, setHead, stepForward, stepBack, reset, canUndo: history.length > 0
  };
};

// --- Multi-Tape Hook ---
export const useMultiTapeTuringMachine = (initialCells = 13, numTapes = 2) => {
  const initialHead = Math.floor(initialCells / 2);

  const [tapes, setTapes] = useState(
    Array.from({ length: numTapes }, () => Array(initialCells).fill(""))
  );
  const [heads, setHeads] = useState(Array(numTapes).fill(initialHead));

  const [activeNodeId, setActiveNodeId] = useState(null);
  const [activeEdgeId, setActiveEdgeId] = useState(null);
  
  const [lastRead, setLastRead] = useState(Array(numTapes).fill(null));
  
  const [stepCount, setStepCount] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [history, setHistory] = useState([]);

  // --- RESET ---
  const reset = useCallback(() => {
    setTapes(Array.from({ length: numTapes }, () => Array(initialCells).fill("")));
    setHeads(Array(numTapes).fill(initialHead));
    setActiveNodeId(null);
    setActiveEdgeId(null);
    setLastRead(Array(numTapes).fill(null));
    setStepCount(0);
    setError(null);
    setSuccess(false);
    setHistory([]);
  }, [initialCells, initialHead, numTapes]);

  // --- STEP BACK ---
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

  // --- STEP FORWARD ---
  const stepForward = useCallback((nodes, edges) => {
    if (error || success) return;

    let currentState = activeNodeId;

    if (!currentState) {
      const startNode = getStartNode(nodes);
      if (!startNode) {
        setError("No Start Node");
        return;
      }
      
      setHistory(prev => [
        ...prev,
        {
          tapes: tapes.map(t => [...t]),
          heads: [...heads],
          activeNodeId: null, 
          activeEdgeId: null,
          lastRead: Array(numTapes).fill(null),
          stepCount
        }
      ]);

      currentState = startNode.id;
      setActiveNodeId(currentState);
      return;
    }

    const result = stepMultiTM({
      currentNodeId: currentState,
      tapes,
      heads,
      nodes,
      edges,
      stepCount // Pass current count to engine
    });

    if (result.halted) {
      setActiveEdgeId(null);
      setError(result.reason);
      setStepCount(result.stepCount || stepCount);
      return;
    }

    setHistory(prev => [
      ...prev,
      {
        tapes: tapes.map(t => [...t]),
        heads: [...heads],
        activeNodeId: currentState,
        activeEdgeId,
        lastRead,
        stepCount
      }
    ]);

    const newTapes = tapes.map(t => [...t]);
    const newHeads = [...heads];
    
    for(let i = 0; i < numTapes; i++) {
        const w = result.writes[i];
        newTapes[i][newHeads[i]] = w === "␣" ? "" : w;

        const dir = result.directions[i];
        if (dir === "R") newHeads[i]++;
        if (dir === "L") newHeads[i]--;

        const edgeThreshold = 6;
        const expansionSize = 6;
        
        if (newHeads[i] < edgeThreshold) {
            const expansion = Array(expansionSize).fill("");
            newTapes[i] = [...expansion, ...newTapes[i]];
            newHeads[i] += expansionSize;
        } else if (newHeads[i] >= newTapes[i].length - edgeThreshold) {
            const expansion = Array(expansionSize).fill("");
            newTapes[i] = [...newTapes[i], ...expansion];
        }
    }

    setTapes(newTapes);
    setHeads(newHeads);
    setActiveNodeId(result.toNodeId);
    setActiveEdgeId(result.edgeId);
    setLastRead(result.reads);
    setStepCount(result.stepCount); // Use incremented count from engine

    if (result.isAccept) {
      setSuccess(true);
      return;
    }
  }, [activeNodeId, activeEdgeId, error, success, tapes, heads, lastRead, stepCount, numTapes]);

  return {
    tapes, heads, activeNodeId, activeEdgeId, lastRead, stepCount, error, success,
    setTapes, setHeads, stepForward, stepBack, reset, canUndo: history.length > 0
  };
};

// --- Non-Deterministic Hook ---
export const useNonDeterministicTM = (initialCells = 13) => {
  const initialHead = Math.floor(initialCells / 2);

  const [threads, setThreads] = useState([]);
  const [stepCount, setStepCount] = useState(0);
  const [success, setSuccess] = useState(false);
  const [history, setHistory] = useState([]);

  const setInitialThread = useCallback((inputTape, startHead) => {
      setThreads([{
        id: "1", 
        tape: [...inputTape],
        head: startHead, 
        currentNodeId: null, 
        status: "active",
        stepCount: 0, 
        history: [],
        color: generateThreadColor("1") // Automatically generate unique color for thread "1"
      }]);
      setSuccess(false);
      setStepCount(0);
      setHistory([]);
    }, []);

  const stepForward = useCallback((nodes, edges) => {
    if (success) return;
    
    setHistory(prev => [...prev, { threads: threads, stepCount, success }]);

    let currentThreads = threads;
    const startNode = nodes.find(n => n.type === "start") || null;

    if (stepCount === 0 && threads.length > 0 && threads[0].currentNodeId === null) {
       if (!startNode) return; 
       currentThreads = [{
           ...threads[0],
           currentNodeId: startNode.id
       }];
    }
    
    const { threads: nextThreads, globalAccept } = stepNonDeterministicTM({
        threads: currentThreads,
        nodes,
        edges
    });

    setThreads(nextThreads);
    setStepCount(c => c + 1);
    
    if (globalAccept) {
        setSuccess(true);
    }

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

  return {
    threads, setInitialThread, stepForward, stepBack, reset, canUndo: history.length > 0, success, stepCount
  };
};