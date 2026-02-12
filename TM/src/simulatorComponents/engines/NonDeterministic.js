/* src/simulatorComponents/engines/NonDeterministic.js */

// A curated "High Contrast" Brights Palette.
const HSL_PALETTE = [
  [0, 100, 50],    // 0. Red
  [180, 100, 40],  // 1. Teal
  [280, 100, 55],  // 2. Electric Purple
  [60, 100, 40],   // 3. Dark Gold
  [210, 100, 50],  // 4. Azure Blue
  [120, 100, 40],  // 5. Vivid Green
  [300, 100, 50],  // 6. Magenta
  [30, 100, 50],   // 7. Orange
  [240, 100, 55],  // 8. Bright Blue
  [150, 100, 40],  // 9. Emerald
  [330, 100, 55],  // 10. Hot Pink
  [190, 100, 45],  // 11. Cyan
  [260, 100, 60],  // 12. Lavender
  [15, 100, 50],   // 13. Red-Orange
  [90, 100, 45],   // 14. Lime Green
  [200, 100, 50],  // 15. Sky Blue
  [45, 100, 45],   // 16. Amber
  [315, 100, 55],  // 17. Fuchsia
  [255, 100, 55],  // 18. Indigo
  [345, 100, 50]   // 19. Crimson
];

function fnv1aHash(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function generateThreadColor(str) {
  const hash = fnv1aHash(str);
  const depth = str.split('.').length;
  const depthOffset = depth * 11; 

  const index = (hash + depthOffset) % HSL_PALETTE.length;
  let [h, s, l] = HSL_PALETTE[index];

  const cycle = Math.floor((hash + depthOffset) / HSL_PALETTE.length);
  if (cycle > 0) {
     h = (h + (cycle * 137.5)) % 360; 
     const lightShift = (cycle % 2 === 0) ? 15 : -10;
     l = Math.max(35, Math.min(75, l + lightShift));
  }

  return `hsl(${h}, ${s}%, ${l}%)`;
}

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
          rule // We pass the rule object so we can track it later
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
        lastRule: trans.rule, // <--- SAVE THE RULE HERE
        status: isAccept ? "accepted" : "active",
        stepCount: (thread.stepCount || 0) + 1,
        history: [...(thread.history || []), trans.toNodeId],
        color: thread.color 
      });
    }
    else {
      // Freeze parent
      nextThreads.push({ ...thread, status: "frozen" });

      // Branch
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
        
        nextThreads.push({
          id: nextId, 
          parentId: thread.id,
          tape: newTape,
          head: newHead,
          currentNodeId: trans.toNodeId,
          activeEdgeId: trans.edgeId,
          lastRead: read,
          lastRule: trans.rule, // <--- SAVE THE RULE HERE
          status: isAccept ? "accepted" : "active",
          stepCount: (thread.stepCount || 0) + 1,
          history: [...(thread.history || []), trans.toNodeId],
          color: generateThreadColor(nextId)
        });
      });
    }
  });

  return { threads: nextThreads, globalAccept };
}