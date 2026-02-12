/* src/simulatorComponents/engines/NonDeterministic.js */

// Distinct colors for NTM threads
const THREAD_COLORS = [
  "#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231", 
  "#911eb4", "#46f0f0", "#f032e6", "#bcf60c", "#fabebe", 
  "#008080", "#e6beff", "#9a6324", "#fffac8", "#800000", 
  "#aaffc3", "#808000", "#ffd8b1", "#000075", "#808080"
];

function isAcceptNode(node) {
  return node && node.type === "accept";
}

export function findAllTransitions(currentNodeId, readSymbol, edges) {
  const outgoing = edges.filter((e) => e.source === currentNodeId);
  const matches = [];

  for (const edge of outgoing) {
    const labels = edge.data?.labels || [];
    labels.forEach((rule) => {
      if (rule.read === readSymbol || (rule.read === "␣" && readSymbol === "")) {
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

export function stepNonDeterministicTM({ threads, nodes, edges }) {
  const nextThreads = [];
  let globalAccept = false;

  threads.forEach((thread) => {
    if (thread.status !== "active") {
      nextThreads.push(thread);
      return;
    }

    const read = thread.tape[thread.head] || "";
    const transitions = findAllTransitions(thread.currentNodeId, read, edges);

    if (transitions.length === 0) {
      nextThreads.push({
        ...thread,
        status: "rejected",
        lastStepInfo: "No transition"
      });
    } 
    else if (transitions.length === 1) {
      const trans = transitions[0];
      const nextNode = nodes.find(n => n.id === trans.toNodeId);
      const isAccept = isAcceptNode(nextNode);
      if (isAccept) globalAccept = true;

      let newTape = [...thread.tape];
      const valToWrite = trans.rule.write === "␣" ? "" : trans.rule.write;
      newTape[thread.head] = valToWrite;

      let newHead = thread.head;
      if (trans.rule.direction === "R") newHead++;
      if (trans.rule.direction === "L") newHead--;

      const edgeThreshold = 15;
      const expansionSize = 20;
      if (newHead < edgeThreshold) {
        const expansion = Array(expansionSize).fill("");
        newTape = [...expansion, ...newTape];
        newHead += expansionSize;
      } else if (newHead >= newTape.length - edgeThreshold) {
        const expansion = Array(expansionSize).fill("");
        newTape = [...newTape, ...expansion];
      }

      nextThreads.push({
        ...thread,
        tape: newTape,
        head: newHead,
        currentNodeId: trans.toNodeId,
        activeEdgeId: trans.edgeId,
        lastRead: read,
        status: isAccept ? "accepted" : "active",
        stepCount: (thread.stepCount || 0) + 1,
        history: [...(thread.history || []), trans.toNodeId],
        color: thread.color || THREAD_COLORS[0]
      });
    }
    else {
      nextThreads.push({
        ...thread,
        status: "frozen" 
      });

      transitions.forEach((trans, index) => {
        const nextNode = nodes.find(n => n.id === trans.toNodeId);
        const isAccept = isAcceptNode(nextNode);
        if (isAccept) globalAccept = true;

        let newTape = [...thread.tape];
        const valToWrite = trans.rule.write === "␣" ? "" : trans.rule.write;
        newTape[thread.head] = valToWrite;

        let newHead = thread.head;
        if (trans.rule.direction === "R") newHead++;
        if (trans.rule.direction === "L") newHead--;

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

        const nextId = `${thread.id}.${index + 1}`;
        // Assign a new color from the list based on a hash of the thread ID
        const colorIdx = (nextThreads.length + index) % THREAD_COLORS.length;

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
          history: [...(thread.history || []), trans.toNodeId],
          color: THREAD_COLORS[colorIdx]
        });
      });
    }
  });

  return {
    threads: nextThreads,
    globalAccept
  };
}