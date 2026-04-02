/**
 * convertToOneWay.js
 *
 * Converts a standard (two-way infinite tape) DTM into an equivalent
 * one-way infinite tape DTM using the interleaving / state-doubling construction.
 *
 * ── Tape encoding ────────────────────────────────────────────────────────────
 * The two-way tape  ...l₋₂  l₋₁  l₀  l₁  l₂...
 * is folded onto a one-way tape starting at index 0:
 *
 * Index:  0    1     2    3     4    5     6 ...
 * Cell:   |   l₀    l₋₁  l₁    l₋₂  l₂    l₋₃ ...
 *
 * Index 0            → left-end wall  |
 * Odd index 2k-1     → Track R (positive cell l_{k-1})  (k ≥ 1) 
 * Even index 2k      → Track L (negative cell l_{-k})   (k ≥ 1) 
 *
 * ── State doubling ───────────────────────────────────────────────────────────
 * Each original state q becomes two states:
 * q_R  – head is currently on Track R (positive / odd-index) side
 * q_L  – head is currently on Track L (negative / even-index) side
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const BLANK    = '␣';
const LEFT_END = '|';   // written at one-way index 0

// ─── Node / edge factories ────────────────────────────────────────────────────

function makeNode(id, label, type = 'normal', x = 0, y = 0) {
  return { id, type, position: { x, y }, data: { label } };
}

function makeEdge(source, target, labels) {
  return {
    id: `e_${source}_${target}_${Math.random().toString(36).slice(2, 7)}`,
    type: 'draggable',
    source,
    target,
    markerEnd: { type: 'arrowclosed', color: '#333' },
    data: { labels, t: 0.5 },
  };
}

function rule(read, write, direction) {
  return { read, write, direction };
}

// ─── GraphBuilder ─────────────────────────────────────────────────────────────

class GraphBuilder {
  constructor() {
    this.nodes    = [];
    this.edges    = [];
    this._created = new Set();
  }

  addNode(id, label, type = 'normal') {
    if (!this._created.has(id)) {
      this.nodes.push(makeNode(id, label, type));
      this._created.add(id);
    }
  }

  addEdge(source, target, labels) {
    this.edges.push(makeEdge(source, target, labels));
  }

  mergeParallelEdges() {
    const edgeMap      = new Map();
    const labelSigSeen = new Map();
    for (const e of this.edges) {
      const key = `${e.source}||${e.target}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, { ...e, data: { ...e.data, labels: [] } });
        labelSigSeen.set(key, new Set());
      }
      const merged = edgeMap.get(key);
      const seen   = labelSigSeen.get(key);
      for (const lbl of (e.data.labels || [])) {
        const sig = JSON.stringify(lbl);
        if (!seen.has(sig)) { seen.add(sig); merged.data.labels.push(lbl); }
      }
    }
    this.edges = [...edgeMap.values()];
  }

  applyLayout(rootId) {
    const levels = { [rootId]: 0 };
    const queue  = [rootId];
    const adj    = {};
    for (const e of this.edges) (adj[e.source] ||= []).push(e.target);
    while (queue.length > 0) {
      const cur = queue.shift();
      for (const nb of (adj[cur] || [])) {
        if (levels[nb] === undefined) { levels[nb] = levels[cur] + 1; queue.push(nb); }
      }
    }
    const byLevel = {};
    for (const n of this.nodes) {
      const lv = levels[n.id] ?? 0;
      (byLevel[lv] ||= []).push(n);
    }
    const X_GAP = 200, Y_GAP = 100;
    for (const [lv, grp] of Object.entries(byLevel)) {
      const totalH = (grp.length - 1) * Y_GAP;
      grp.forEach((n, i) => {
        n.position = { x: Number(lv) * X_GAP, y: i * Y_GAP - totalH / 2 };
      });
    }
  }
}

// ─── Alphabet helpers ─────────────────────────────────────────────────────────

function buildAlphabet(edges) {
  const alpha = new Set([BLANK]);
  for (const edge of edges) {
    for (const lbl of (edge.data?.labels || [])) {
      if (lbl.read)  alpha.add(lbl.read);
      if (lbl.write) alpha.add(lbl.write);
    }
  }
  return alpha;
}

// ─── State-id helpers ─────────────────────────────────────────────────────────

const sid = {
  R: (q)      => `${q}_R`,        // on odd (Track R / positive) track
  L: (q)      => `${q}_L`,        // on even (Track L / negative) track
  hop: (q, tag) => `${q}_hop_${tag}`,
};

// ─── Main conversion ──────────────────────────────────────────────────────────

export function convertToOneWay(origNodes, origEdges) {

  // ── 1. Analyse input ────────────────────────────────────────────────────────
  const alphabet = buildAlphabet(origEdges);

  const startOrig = origNodes.find(n => n.type === 'start');
  if (!startOrig) {
    const emptyGraph = new GraphBuilder();
    emptyGraph.addNode('q_ow_init', 'init', 'start');
    emptyGraph.applyLayout('q_ow_init');
    return { nodes: emptyGraph.nodes, edges: emptyGraph.edges };
  }

  const acceptIds = new Set(origNodes.filter(n => n.type === 'accept').map(n => n.id));
  const nodeLabel = (id) => origNodes.find(n => n.id === id)?.data?.label ?? id;
  const nodeType  = (id) => acceptIds.has(id) ? 'accept' : 'normal';

  const transitions = {};
  for (const edge of origEdges) {
    if (!transitions[edge.source]) transitions[edge.source] = [];
    for (const lbl of (edge.data?.labels || [])) {
      transitions[edge.source].push({
        target:    edge.target,
        read:      lbl.read,
        write:     lbl.write,
        direction: lbl.direction,
      });
    }
  }

  const graph = new GraphBuilder();

  // ── 2. Bootstrap ─────────────────────────────────────────────────────────────
  // Tape layout starts with | at index 0. l₀ is at index 1.
  // INIT state reads |, moves R, and lands exactly on l₀ in the _R state.
  const INIT_ID   = 'q_ow_init';
  const firstPos  = sid.R(startOrig.id);

  graph.addNode(INIT_ID,  'init', 'start');
  graph.addNode(firstPos, `${nodeLabel(startOrig.id)}_R`, nodeType(startOrig.id));
  graph.addEdge(INIT_ID, firstPos, [rule(LEFT_END, LEFT_END, 'R')]);

  // ── 3. BFS over original states ──────────────────────────────────────────────
  const visited = new Set([startOrig.id]);
  const queue   = [startOrig.id];

  while (queue.length > 0) {
    const qId = queue.shift();
    if (acceptIds.has(qId)) continue;

    const qTrans  = transitions[qId] || [];
    const posId   = sid.R(qId);
    const negId   = sid.L(qId);
    
    graph.addNode(posId, `${nodeLabel(qId)}_R`, nodeType(qId));
    graph.addNode(negId, `${nodeLabel(qId)}_L`, nodeType(qId));

    // Universal Boundary Rule for Track L: 
    // If a Track L state ever wakes up on the '|' marker, it crossed zero! 
    // It must bounce right back onto Track R.
    graph.addEdge(negId, posId, [rule(LEFT_END, LEFT_END, 'R')]);

    for (const { target, read, write, direction } of qTrans) {

      const tPosId = sid.R(target);
      const tNegId = sid.L(target);
      graph.addNode(tPosId, `${nodeLabel(target)}_R`, nodeType(target));
      graph.addNode(tNegId, `${nodeLabel(target)}_L`, nodeType(target));

      const tag = `${qId}_${target}_${read}_${direction}`;

      if (direction === 'R') {
        // ────────────────────────────────────────────────────────────────────
        // Track R, logical R → physical +2
        // ────────────────────────────────────────────────────────────────────
        const hopRR = sid.hop(tag, 'RR');
        graph.addNode(hopRR, `hop_R_R\n${nodeLabel(target)}`);
        graph.addEdge(posId, hopRR, [rule(read, write, 'R')]);
        for (const sym of alphabet) {
          graph.addEdge(hopRR, tPosId, [rule(sym, sym, 'R')]);
        }

        // ────────────────────────────────────────────────────────────────────
        // Track L, logical R → physical -2 (moves towards 0)
        // ────────────────────────────────────────────────────────────────────
        const hopLR = sid.hop(tag, 'LR');
        graph.addNode(hopLR, `hop_L_R\n${nodeLabel(target)}`);
        graph.addEdge(negId, hopLR, [rule(read, write, 'L')]);
        for (const sym of alphabet) {
          graph.addEdge(hopLR, tNegId, [rule(sym, sym, 'L')]);
        }

      } else if (direction === 'L') {
        // ────────────────────────────────────────────────────────────────────
        // Track R, logical L → physical -2 (moves towards 0)
        // Boundary case: If it lands on 0 during the hop, it reads | and bounces
        // ────────────────────────────────────────────────────────────────────
        const hopRL = sid.hop(tag, 'RL');
        const hopRLBounce = sid.hop(tag, 'RLBounce');
        graph.addNode(hopRL, `hop_R_L\n${nodeLabel(target)}`);
        graph.addNode(hopRLBounce, `bnc_R_L\n${nodeLabel(target)}`);

        graph.addEdge(posId, hopRL, [rule(read, write, 'L')]);
        
        // Boundary Bounce
        graph.addEdge(hopRL, hopRLBounce, [rule(LEFT_END, LEFT_END, 'R')]);
        for (const sym of alphabet) {
          graph.addEdge(hopRLBounce, tNegId, [rule(sym, sym, 'R')]);
        }
        
        // Normal Move
        for (const sym of alphabet) {
          graph.addEdge(hopRL, tPosId, [rule(sym, sym, 'L')]);
        }

        // ────────────────────────────────────────────────────────────────────
        // Track L, logical L → physical +2 (moves further negative)
        // ────────────────────────────────────────────────────────────────────
        const hopLL = sid.hop(tag, 'LL');
        graph.addNode(hopLL, `hop_L_L\n${nodeLabel(target)}`);
        graph.addEdge(negId, hopLL, [rule(read, write, 'R')]);
        for (const sym of alphabet) {
          graph.addEdge(hopLL, tNegId, [rule(sym, sym, 'R')]);
        }

      } else {
        // 'N' or 'S' (Stay)
        graph.addEdge(posId, tPosId, [rule(read, write, direction)]);
        graph.addEdge(negId, tNegId, [rule(read, write, direction)]);
      }

      if (!visited.has(target)) { visited.add(target); queue.push(target); }
    }
  }

  // ── 4. Post-process ──────────────────────────────────────────────────────────
  graph.mergeParallelEdges();

  const reachable = new Set([INIT_ID]);
  const bfsQ      = [INIT_ID];
  const adjFwd    = {};
  for (const e of graph.edges) (adjFwd[e.source] ||= []).push(e.target);
  while (bfsQ.length > 0) {
    for (const nb of (adjFwd[bfsQ.shift()] || [])) {
      if (!reachable.has(nb)) { reachable.add(nb); bfsQ.push(nb); }
    }
  }
  graph.nodes = graph.nodes.filter(n => reachable.has(n.id));
  graph.edges = graph.edges.filter(e =>
    reachable.has(e.source) &&
    reachable.has(e.target) &&
    graph.nodes.find(n => n.id === e.source)?.type !== 'accept'
  );

  graph.applyLayout(INIT_ID);
  return { nodes: graph.nodes, edges: graph.edges };
}

// ─── Tape builder for the simulation ─────────────────────────────────────────

const OW_PADDING = 40;

/**
 * Builds the initial one-way tape array for simulation.
 *
 * Physical layout (relative to the | marker):
 * phys index:  0    1     2    3     4    5     6 ...
 * content:     |   l₀    l₋₁   l₁   l₋₂   l₂   l₋₃ ...
 *
 * Odd indices  = right / positive track  (input starts here)
 * Even indices = left  / negative track  (all blanks initially)
 */
export function buildOneWayTape(inputStr) {
  const chars = inputStr ? inputStr.split('') : [];
  const tape  = [];

  // Padding before the wall
  for (let i = 0; i < OW_PADDING * 2; i++) tape.push(BLANK);

  // The wall at index OW_PADDING * 2
  tape.push(LEFT_END);  

  const len = Math.max(chars.length, 1);
  for (let k = 0; k < len; k++) {
    const ch = chars[k];
    // Odd physically, but logical l_k (Track R)
    tape.push(ch !== undefined ? (ch === ' ' ? BLANK : ch) : BLANK); 
    // Even physically, but logical l_{-(k+1)} (Track L)
    tape.push(BLANK);  
  }

  // Trailing padding
  for (let i = 0; i < OW_PADDING * 2; i++) tape.push(BLANK);

  // Head starts on l₀ = exact index after the wall
  return { tape, head: OW_PADDING * 2};
}