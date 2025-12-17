export function getStartNode(nodes) {
  return nodes.find(n => n.type === "start") || null;
}

export function isAcceptNode(node) {
  return node?.type === "accept";
}

export function getNodeLabel(node) {
  return node?.data?.label || node?.id || "";
}

export function findTransition(currentNodeId, readSymbol, edges) {
  const outgoing = edges.filter(e => e.source === currentNodeId);

  for (const edge of outgoing) {
    const labels = edge.data?.labels || [];
    
    // Match if exact match OR if rule is '*' and tape is empty
    const rule = labels.find(l => 
      l.read === readSymbol || (l.read === '*' && readSymbol === "")
    );

    if (rule) {
      return {
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

export function stepTM({ currentNodeId, tape, head, nodes, edges }) {
  const read = tape[head] || "";

  const transition = findTransition(currentNodeId, read, edges);

  if (isHalt(transition)) {
    return {
      halted: true,
      reason: "No transition defined",
      read,
      fromNodeId: currentNodeId
    };
  }

  const { toNodeId, rule } = transition;
  const nextNode = nodes.find(n => n.id === toNodeId);

  return {
    halted: false,
    read,
    write: rule.write,
    direction: rule.direction,
    fromNodeId: currentNodeId,
    toNodeId,
    isAccept: isAcceptNode(nextNode),
    rule
  };
}