/* src/simulatorComponents/engines/Deterministic.js */

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
 * Finds the transition (edge + rule) for the current state and read symbol
 */
export function findTransition(currentNodeId, readSymbol, edges) {
  const outgoing = edges.filter(e => e.source === currentNodeId);

  for (const edge of outgoing) {
    const labels = edge.data?.labels || [];

    const rule = labels.find(l =>
      l.read === readSymbol || (l.read === '␣' && readSymbol === "")
    );

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

export function isHalt(transition) {
  return transition === null;
}

export function stepTM({ currentNodeId, tape, head, nodes, edges, stepCount = 0 }) {
  const read = tape[head] || "";

  const transition = findTransition(currentNodeId, read, edges);

  if (isHalt(transition)) {
    return {
      halted: true,
      reason: "No transition defined",
      read,
      fromNodeId: currentNodeId,
      stepCount // Return current count on halt
    };
  }

  const { toNodeId, rule, edgeId } = transition;
  const nextNode = nodes.find(n => n.id === toNodeId);

  return {
    halted: false,
    read,
    write: rule.write,
    direction: rule.direction,
    fromNodeId: currentNodeId,
    toNodeId,
    edgeId,
    isAccept: isAcceptNode(nextNode),
    rule,
    stepCount: stepCount + 1 // Increment step count
  };
}