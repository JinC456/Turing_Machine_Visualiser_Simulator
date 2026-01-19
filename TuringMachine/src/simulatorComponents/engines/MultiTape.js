/* src/simulatorComponents/engines/MultiTape.js */

export function getStartNode(nodes) {
  return nodes.find(n => n.type === "start") || null;
}

export function isAcceptNode(node) {
  return node?.type === "accept";
}

export function getNodeLabel(node) {
  return node?.data?.label || node?.id || "";
}

/**
 * Finds the transition for the current state and read symbols (array)
 */
export function findTransition(currentNodeId, readSymbols, edges) {
  const outgoing = edges.filter(e => e.source === currentNodeId);

  for (const edge of outgoing) {
    const labels = edge.data?.labels || [];

    // Find a label where ALL tapes match
    const rule = labels.find(l => {
      // Check Tape 1
      const r1 = l.tape1?.read;
      const s1 = readSymbols[0];
      const match1 = r1 === s1 || (r1 === '*' && s1 === "");

      // Check Tape 2
      const r2 = l.tape2?.read;
      const s2 = readSymbols[1];
      const match2 = r2 === s2 || (r2 === '*' && s2 === "");

      return match1 && match2;
    });

    if (rule) {
      return {
        edgeId: edge.id,
        toNodeId: edge.target,
        rule
      };
    }
  }

  return null;
}

export function stepMultiTM({ currentNodeId, tapes, heads, nodes, edges }) {
  // Read current symbols from all tapes
  const reads = heads.map((h, i) => tapes[i][h] || "");

  const transition = findTransition(currentNodeId, reads, edges);

  if (!transition) {
    return {
      halted: true,
      reason: "No transition defined",
      reads,
      fromNodeId: currentNodeId
    };
  }

  const { toNodeId, rule, edgeId } = transition;
  const nextNode = nodes.find(n => n.id === toNodeId);

  return {
    halted: false,

    reads,
    // Extract writes and directions for both tapes
    writes: [rule.tape1.write, rule.tape2.write],
    directions: [rule.tape1.direction, rule.tape2.direction],

    fromNodeId: currentNodeId,
    toNodeId,

    edgeId,

    isAccept: isAcceptNode(nextNode),
    rule
  };
}