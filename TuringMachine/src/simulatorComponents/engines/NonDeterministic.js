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
 * Handles splitting, moving, and rejecting.
 */
export function stepNonDeterministicTM({ threads, nodes, edges }) {
  const nextThreads = [];
  let globalAccept = false;

  threads.forEach((thread) => {
    // If thread is already rejected or accepted (shouldn't happen if cleaned up), skip
    if (thread.status !== "active") return;

    // 1. Get current read symbol
    const read = thread.tape[thread.head] || "";

    // 2. Find ALL transitions
    const transitions = findAllTransitions(thread.currentNodeId, read, edges);

    // 3. Process Transitions
    if (transitions.length === 0) {
      // Dead End -> Reject
      // We keep it for one frame marked as "rejected" so the user sees it died
      // (We preserve the ID here too so the red flash animates on the same card)
      nextThreads.push({
        ...thread,
        status: "rejected",
        lastStepInfo: "No transition"
      });
    } else {
      // For every valid transition, create a new thread state (Split)
      transitions.forEach((trans, index) => {
        const nextNode = nodes.find(n => n.id === trans.toNodeId);
        const isAccept = isAcceptNode(nextNode);
        if (isAccept) globalAccept = true;

        // Clone Tape
        let newTape = [...thread.tape];
        
        // Write
        const valToWrite = trans.rule.write === '*' ? "" : trans.rule.write;
        newTape[thread.head] = valToWrite;

        // Move Head
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

        // --- FIX: ID PRESERVATION ---
        // If this is the FIRST transition option, we recycle the parent's ID.
        // This tricks React into thinking it's the "same" thread moving, 
        // which allows the CSS transition to animate smoothly.
        // Any EXTRA transitions (index > 0) get new IDs (splits).
        const nextId = (index === 0) ? thread.id : crypto.randomUUID();

        nextThreads.push({
          id: nextId, 
          parentId: thread.id,
          tape: newTape,
          head: newHead,
          currentNodeId: trans.toNodeId,
          activeEdgeId: trans.edgeId,
          lastRead: read,
          status: isAccept ? "accepted" : "active",
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