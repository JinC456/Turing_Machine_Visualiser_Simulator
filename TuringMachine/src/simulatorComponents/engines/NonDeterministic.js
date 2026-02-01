/* src/simulatorComponents/engines/NonDeterministic.js */

/**
 * Helper to check if a node is an accept node.
 */
function isAcceptNode(node) {
  return node && node.type === "accept";
}

/**
 * Finds ALL valid transitions for a given state and read symbol.
 * Returns an array of rule objects.
 */
export function findAllTransitions(currentNodeId, readSymbol, edges) {
  const outgoing = edges.filter((e) => e.source === currentNodeId);
  const matches = [];

  for (const edge of outgoing) {
    const labels = edge.data?.labels || [];
    
    // Check all labels on this edge
    labels.forEach((rule) => {
      // Standard single-tape check
      if (rule.read === readSymbol || (rule.read === '*' && readSymbol === "")) {
        matches.push({
          edgeId: edge.id,
          toNodeId: edge.target,
          rule
        });
      }
    });
  }

  return matches;
}

/**
 * Steps the entire list of threads forward by 1 tick.
 * * LOGIC CHANGE:
 * - 0 Transitions: Reject in place.
 * - 1 Transition:  Update in place (Normal TM behavior).
 * - >1 Transition: Freeze current thread, spawn children (Tree Split behavior).
 */
export function stepNonDeterministicTM({ threads, nodes, edges }) {
  const nextThreads = [];
  let globalAccept = false;

  threads.forEach((thread) => {
    // 1. Skip threads that are not active (frozen/rejected/accepted just carry over)
    if (thread.status !== "active") {
      nextThreads.push(thread);
      return;
    }

    const read = thread.tape[thread.head] || "";
    const transitions = findAllTransitions(thread.currentNodeId, read, edges);

    // --- CASE A: NO TRANSITION (REJECT) ---
    if (transitions.length === 0) {
      nextThreads.push({
        ...thread,
        status: "rejected",
        lastStepInfo: "No transition"
      });
    } 
    // --- CASE B: SINGLE TRANSITION (NORMAL TM STEP) ---
    else if (transitions.length === 1) {
      const trans = transitions[0];
      const nextNode = nodes.find(n => n.id === trans.toNodeId);
      const isAccept = isAcceptNode(nextNode);
      if (isAccept) globalAccept = true;

      // Apply Logic (Clone, Write, Move, Expand)
      let newTape = [...thread.tape];
      const valToWrite = trans.rule.write === '*' ? "" : trans.rule.write;
      newTape[thread.head] = valToWrite;

      let newHead = thread.head;
      if (trans.rule.direction === "R") newHead++;
      if (trans.rule.direction === "L") newHead--;

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

      // Update In Place: Keep same ID, update state
      nextThreads.push({
        ...thread, // Keep ID, parentId, etc.
        tape: newTape,
        head: newHead,
        currentNodeId: trans.toNodeId,
        activeEdgeId: trans.edgeId,
        lastRead: read,
        status: isAccept ? "accepted" : "active",
        stepCount: (thread.stepCount || 0) + 1,
        history: [...(thread.history || []), trans.toNodeId] 
      });
    }
    // --- CASE C: MULTIPLE TRANSITIONS (SPLIT) ---
    else {
      // 1. Freeze the current thread state (It becomes a history node)
      nextThreads.push({
        ...thread,
        status: "frozen" 
      });

      // 2. Spawn new children for each branch
      transitions.forEach((trans, index) => {
        const nextNode = nodes.find(n => n.id === trans.toNodeId);
        const isAccept = isAcceptNode(nextNode);
        if (isAccept) globalAccept = true;

        let newTape = [...thread.tape];
        const valToWrite = trans.rule.write === '*' ? "" : trans.rule.write;
        newTape[thread.head] = valToWrite;

        let newHead = thread.head;
        if (trans.rule.direction === "R") newHead++;
        if (trans.rule.direction === "L") newHead--;

        // Handle Expansion
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

        // Generate Tree ID: 1 -> 1.1, 1.2 (Using 1-based index)
        const nextId = `${thread.id}.${index + 1}`;

        nextThreads.push({
          id: nextId, 
          parentId: thread.id,
          tape: newTape,
          head: newHead,
          currentNodeId: trans.toNodeId,
          activeEdgeId: trans.edgeId,
          lastRead: read,
          status: isAccept ? "accepted" : "active",
          stepCount: (thread.stepCount || 0) + 1,
          history: [...(thread.history || []), trans.toNodeId] 
        });
      });
    }
  });

  return {
    threads: nextThreads,
    globalAccept
  };
}