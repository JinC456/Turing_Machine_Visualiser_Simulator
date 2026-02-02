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
  const numTapes = readSymbols.length;

  for (const edge of outgoing) {
    const labels = edge.data?.labels || [];

    const rule = labels.find(l => {
        for(let i=0; i<numTapes; i++) {
            const key = `tape${i+1}`;
            const ruleData = l[key];
            const currentSym = readSymbols[i];
            
            if (ruleData) {
                if (ruleData.read !== currentSym && !(ruleData.read === '*' && currentSym === "")) {
                    return false;
                }
            }
        }
        return true;
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

export function stepMultiTM({ currentNodeId, tapes, heads, nodes, edges, stepCount = 0 }) {
  // Read current symbols from all tapes
  const reads = heads.map((h, i) => tapes[i][h] || "");

  const transition = findTransition(currentNodeId, reads, edges);

  if (!transition) {
    return {
      halted: true,
      reason: "No transition defined",
      reads,
      fromNodeId: currentNodeId,
      stepCount // Return current count on halt
    };
  }

  const { toNodeId, rule, edgeId } = transition;
  const nextNode = nodes.find(n => n.id === toNodeId);

  const writes = [];
  const directions = [];
  
  for(let i=0; i<tapes.length; i++) {
      const key = `tape${i+1}`;
      const r = rule[key];
      if (r) {
          writes.push(r.write);
          directions.push(r.direction);
      } else {
          writes.push(reads[i] || "*"); 
          directions.push("N");
      }
  }

  return {
    halted: false,
    reads,
    writes,
    directions,
    fromNodeId: currentNodeId,
    toNodeId,
    edgeId,
    isAccept: isAcceptNode(nextNode),
    rule,
    stepCount: stepCount + 1 // Increment step count
  };
}