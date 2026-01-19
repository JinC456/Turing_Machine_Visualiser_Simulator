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

    // Find a label where ALL tapes match
    const rule = labels.find(l => {
        // Iterate over all active tapes
        for(let i=0; i<numTapes; i++) {
            const key = `tape${i+1}`;
            const ruleData = l[key]; // Might be undefined if edge was created when fewer tapes existed
            
            // If rule doesn't specify this tape, treat it as wildcard? 
            // Or strictly require definition? 
            // Usually in TMs, if it's undefined it's not a match.
            // But for "legacy" edges (2 tapes) in a 3 tape system, we treat missing as "don't care" or "blank"?
            // Let's assume strict: if rule is missing tape definition, it matches blank (implicit)
            // OR strictly, the rule must define all tapes.
            // Let's go with: Undefined in rule = matches BLANK ('') and stays in place.
            
            const rRead = ruleData ? ruleData.read : '*'; // Default to wildcard if missing?
            // Actually, safer to treat missing as "Matches Empty/Blank" to avoid stuck states.
            
            const currentSym = readSymbols[i];
            
            // Logic:
            // if ruleData exists: check match
            // if ruleData missing: match against wildcard logic (matches anything? or matches blank?)
            
            if (ruleData) {
                if (ruleData.read !== currentSym && !(ruleData.read === '*' && currentSym === "")) {
                    return false;
                }
            } else {
                 // If the rule has NO definition for Tape 3, but we are simulating 3 tapes:
                 // We effectively ignore this tape? No, that breaks determinism.
                 // We'll treat it as matching a wildcard.
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

  // Extract writes and directions
  const writes = [];
  const directions = [];
  
  // We iterate over the *actual* number of tapes in simulation
  for(let i=0; i<tapes.length; i++) {
      const key = `tape${i+1}`;
      const r = rule[key];
      if (r) {
          writes.push(r.write);
          directions.push(r.direction);
      } else {
          // If rule doesn't specify, we write back what we read (no change) and stay (N)
          writes.push(reads[i] || "*"); // * writes blank
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
    rule
  };
}