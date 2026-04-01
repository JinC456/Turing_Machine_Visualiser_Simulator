const BLANK = '␣';
const LWALL = '[';
const RWALL = ']';

function makeNode(id, label, type = 'normal') {
  return { id, type, position: { x: 0, y: 0 }, data: { label } };
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

function label(...tapeRules) {
  const obj = {};
  for (const [key, rule] of tapeRules) obj[key] = rule;
  return obj;
}

function r(read, write, direction) {
  return { read, write, direction };
}

class GraphBuilder {
  constructor() {
    this.nodes    = [];
    this.edges    = [];
    this._created = new Set();
  }

  addNode(id, nodeLabel, type = 'normal') {
    if (!this._created.has(id)) {
      this.nodes.push(makeNode(id, nodeLabel, type));
      this._created.add(id);
    }
  }

  addEdge(source, target, labels) {
    this.edges.push(makeEdge(source, target, labels));
  }

  mergeParallelEdges() {
    const edgeMap = new Map();
    const seen    = new Map();
    for (const e of this.edges) {
      const key = `${e.source}||${e.target}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, { ...e, data: { ...e.data, labels: [] } });
        seen.set(key, new Set());
      }
      for (const lbl of (e.data.labels || [])) {
        const sig = JSON.stringify(lbl);
        if (!seen.get(key).has(sig)) {
          seen.get(key).add(sig);
          edgeMap.get(key).data.labels.push(lbl);
        }
      }
    }
    this.edges = [...edgeMap.values()];
  }

  applyLayout(rootId) {
    const levels = { [rootId]: 0 };
    const queue  = [rootId];
    const adj    = {};
    for (const e of this.edges) (adj[e.source] ||= []).push(e.target);
    while (queue.length) {
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
    const X_GAP = 280, Y_GAP = 150;
    for (const [lv, grp] of Object.entries(byLevel)) {
      const totalH = (grp.length - 1) * Y_GAP;
      grp.forEach((n, i) => {
        n.position = { x: Number(lv) * X_GAP, y: i * Y_GAP - totalH / 2 };
      });
    }
  }
}

function buildAlphabet(origEdges) {
  const alpha = new Set([BLANK, LWALL]);
  for (const edge of origEdges) {
    for (const lbl of (edge.data?.labels || [])) {
      if (lbl.read)  alpha.add(lbl.read);
      if (lbl.write) alpha.add(lbl.write);
    }
  }
  return alpha;
}


export function incrementAddress(address, base) {
  if (base < 1) throw new RangeError('base must be at least 1');

  const next = address.slice();

  for (let i = next.length - 1; i >= 0; i--) {
    if (next[i] < base) {
      next[i]++;
      return next;
    }
    next[i] = 1;
  }

  return [1, ...next];
}

export function tapeToAddress(tape, headStart) {
  const digits = [];
  for (let i = headStart; i < tape.length; i++) {
    if (tape[i] === RWALL || tape[i] === BLANK) break;
    digits.push(Number(tape[i]));
  }
  return digits;
}

export function addressToTape(tape, headStart, address) {
  const updated = tape.slice();

  for (let i = headStart; i < updated.length; i++) {
    if (updated[i] === RWALL || updated[i] === BLANK) break;
    updated[i] = BLANK;
  }
  for (let j = 0; j < address.length; j++) {
    updated[headStart + j] = String(address[j]);
  }
  return updated;
}

export function simulatePath(origNodes, origEdges, tape2, head2, address, base) {

  const nodeById = new Map(origNodes.map(n => [n.id, n]));

  const adjOut = new Map();
  for (const node of origNodes) adjOut.set(node.id, []);
  for (const edge of origEdges) {
    if (adjOut.has(edge.source)) adjOut.get(edge.source).push(edge);
  }

  function matchingTransitions(stateId, symbol) {
    const matches = [];
    for (const edge of (adjOut.get(stateId) || [])) {
      for (const lbl of (edge.data?.labels || [])) {
        const rule = lbl.tape1 ?? lbl;
        if (rule.read === symbol) {
          matches.push({ edge, rule });
        }
      }
    }
    return matches;
  }

  function applyTapeAction(tape, head, write, direction) {
    const next = tape.slice();
    next[head] = write;
    let newHead = head;
    
    if      (direction === 'R') newHead = head + 1;
    else if (direction === 'L') newHead = Math.max(0, head - 1);

    if (newHead >= next.length) next.push(BLANK);

    if (direction === 'R' && next[newHead] === RWALL) {
      if (newHead + 1 >= next.length) next.push(BLANK);
      next[newHead + 1] = RWALL;
      next[newHead]     = BLANK;
    }

    if (direction === 'L' && next[newHead] === LWALL) {
      next.splice(newHead + 1, 0, BLANK);
      newHead = newHead + 1; 
    }

    return [next, newHead];
  }

  const startNode = origNodes.find(n => n.type === 'start');
  if (!startNode) {
    return { outcome: 'reject', tape2, head2, steps: 0 };
  }

  let currentState = startNode.id;
  let currentTape  = tape2.slice();
  let currentHead  = head2;
  let steps        = 0;

  for (let addrIdx = 0; addrIdx < address.length; addrIdx++) {
    const chosenBranch = address[addrIdx];

    const stateNode = nodeById.get(currentState);

    if (!stateNode) {
      return { outcome: 'reject', tape2: currentTape, head2: currentHead, steps };
    }

    if (stateNode.type === 'accept') {
      return { outcome: 'accept', tape2: currentTape, head2: currentHead, steps };
    }

    if (stateNode.type === 'reject') {
      return { outcome: 'reject', tape2: currentTape, head2: currentHead, steps };
    }

    let symbol = currentTape[currentHead] ?? BLANK;
    if (symbol === RWALL) symbol = BLANK; 

    const candidates = matchingTransitions(currentState, symbol);

    if (candidates.length === 0) {
      return { outcome: 'reject', tape2: currentTape, head2: currentHead, steps };
    }

    if (chosenBranch < 1 || chosenBranch > candidates.length) {
      return { outcome: 'reject', tape2: currentTape, head2: currentHead, steps };
    }

    const { edge, rule } = candidates[chosenBranch - 1];

    [currentTape, currentHead] = applyTapeAction(
      currentTape, currentHead, rule.write, rule.direction
    );
    currentState = edge.target;
    steps++;
  }

  const finalNode = nodeById.get(currentState);
  if (finalNode?.type === 'accept') {
    return { outcome: 'accept', tape2: currentTape, head2: currentHead, steps };
  }

  return { outcome: 'reject', tape2: currentTape, head2: currentHead, steps };
}

export function convertNtmToDtm(origNodes, origEdges) {
  const startOrig = origNodes.find(n => n.type === 'start');
  if (!startOrig) return { nodes: [], edges: [] };

  const alpha = buildAlphabet(origEdges);
  const inputSymbols = [...alpha].filter(s => s !== BLANK && s !== LWALL && s !== RWALL);

  const base = computeBase(origNodes, origEdges);
  const digits = Array.from({ length: base }, (_, i) => String(i + 1));

  const graph = new GraphBuilder();

  const INIT   = 'D_INIT';
  const COPY   = 'D_S1_COPY';
  const REWIND = 'D_S1_REWIND';

  graph.addNode(INIT,   'INIT',          'start');
  graph.addNode(COPY,   'S1\nCopy\nT1→T2');
  graph.addNode(REWIND, 'S1\nRewind\nT2');

  for (const sym of [...inputSymbols, BLANK]) {
    graph.addEdge(INIT, COPY, [
      label(
        ['tape1', r(sym,   sym,   'N')],
        ['tape2', r(BLANK, BLANK, 'N')],
        ['tape3', r(BLANK, '1',   'N')]
      ),
    ]);
  }

  for (const sym of [...inputSymbols, BLANK]) {
    graph.addEdge(COPY, COPY, [
      label(
        ['tape1', r(sym,   sym,   'R')],
        ['tape2', r(BLANK, sym,   'R')],
        ['tape3', r('1',   '1',   'N')]
      ),
    ]);
  }

  graph.addEdge(COPY, REWIND, [
    label(
      ['tape1', r(RWALL, RWALL, 'N')],
      ['tape2', r(BLANK, RWALL, 'N')],
      ['tape3', r('1',   '1',   'N')]
    ),
  ]);

  for (const sym of [...inputSymbols, BLANK, RWALL]) {
    graph.addEdge(REWIND, REWIND, [
      label(
        ['tape1', r(RWALL, RWALL, 'N')],
        ['tape2', r(sym,   sym,   'L')],
        ['tape3', r('1',   '1',   'N')]
      ),
    ]);
  }

  for (const d of digits) {
    graph.addEdge(REWIND, `D_READ_ADDR_${startOrig.id}`, [
      label(
        ['tape1', r(RWALL, RWALL, 'N')],
        ['tape2', r(LWALL, LWALL, 'R')],
        ['tape3', r(d,     d,     'N')]
      ),
    ]);
  }

  const allSymbols = [...inputSymbols, BLANK];
  const adjOut = new Map();
  for (const n of origNodes) adjOut.set(n.id, []);
  for (const e of origEdges) {
    if (adjOut.has(e.source)) adjOut.get(e.source).push(e);
  }

  function matchingTransitions(stateId, symbol) {
    const matches = [];
    for (const edge of (adjOut.get(stateId) || [])) {
      for (const lbl of (edge.data?.labels || [])) {
        const rule = lbl.tape1 ?? lbl;
        if (rule.read === symbol) matches.push({ edge, rule });
      }
    }
    return matches;
  }

  const RESET_START = 'D_RESET_START';
  graph.addNode(RESET_START, 'Reset\nStart');
  const D_ACCEPT = 'D_ACCEPT';
  graph.addNode(D_ACCEPT, 'ACCEPT', 'accept');

  for (const ntmNode of origNodes) {
    const q      = ntmNode.id;
    const readId = `D_READ_ADDR_${q}`;

    graph.addNode(readId, `Read\nAddr\n(${q})`);
    
    if (ntmNode.type === 'accept') {
      for (const sym of allSymbols) {
        for (const t3sym of [...digits, BLANK]) {
          graph.addEdge(readId, D_ACCEPT, [
            label(
              ['tape1', r(RWALL,  RWALL,  'N')],
              ['tape2', r(sym,    sym,    'N')],
              ['tape3', r(t3sym,  t3sym,  'N')]
            ),
          ]);
        }
      }
      continue;
    }

    // End of Path Reset
    for (const sym of [...allSymbols, RWALL]) {
      graph.addEdge(readId, RESET_START, [
        label(
          ['tape1', r(RWALL, RWALL, 'N')],
          ['tape2', r(sym,   sym,   'N')],
          ['tape3', r(BLANK, BLANK, 'N')]
        ),
      ]);
    }

    // --------------------------------------------------------
    // LEFT WALL SHIFT ALGORITHM
    // --------------------------------------------------------
    const shiftSymbols = [...allSymbols, RWALL]; 

    const shiftStartId  = `D_SHIFT_START_${q}`;
    const shiftReturnId = `D_SHIFT_RETURN_${q}`;
    graph.addNode(shiftStartId,  `Shift\nStart\n(${q})`);
    graph.addNode(shiftReturnId, `Shift\nReturn\n(${q})`);

    for (const t3sym of [...digits, BLANK]) {
      graph.addEdge(readId, shiftStartId, [
        label(
          ['tape1', r(RWALL, RWALL, 'N')],
          ['tape2', r(LWALL, LWALL, 'R')],
          ['tape3', r(t3sym, t3sym, 'N')]
        ),
      ]);
    }

    for (const t3sym of [...digits, BLANK]) {
      for (const sym of shiftSymbols) { 
        const carryId = `D_SHIFT_CARRY_${q}_${sym}`;
        graph.addNode(carryId, `Carry\n${sym}\n(${q})`);
        
        graph.addEdge(shiftStartId, carryId, [
          label(
            ['tape1', r(RWALL, RWALL, 'N')],
            ['tape2', r(sym,   BLANK, 'R')],
            ['tape3', r(t3sym, t3sym, 'N')]
          ),
        ]);
      }
    }

    for (const t3sym of [...digits, BLANK]) {
      for (const carriedSym of shiftSymbols) {
        const carryId = `D_SHIFT_CARRY_${q}_${carriedSym}`;
        
        if (carriedSym === RWALL) {
          graph.addEdge(carryId, shiftReturnId, [
            label(
              ['tape1', r(RWALL, RWALL, 'N')],
              ['tape2', r(BLANK, RWALL, 'L')],
              ['tape3', r(t3sym, t3sym, 'N')]
            ),
          ]);
        } else {
          for (const tapeSym of shiftSymbols) { 
            const nextCarryId = `D_SHIFT_CARRY_${q}_${tapeSym}`;
            graph.addEdge(carryId, nextCarryId, [
              label(
                ['tape1', r(RWALL, RWALL, 'N')],
                ['tape2', r(tapeSym, carriedSym, 'R')],
                ['tape3', r(t3sym, t3sym, 'N')]
              ),
            ]);
          }
        }
      }
    }

    for (const t3sym of [...digits, BLANK]) {
      for (const sym of shiftSymbols) {
        graph.addEdge(shiftReturnId, shiftReturnId, [
          label(
            ['tape1', r(RWALL, RWALL, 'N')],
            ['tape2', r(sym,   sym,   'L')],
            ['tape3', r(t3sym, t3sym, 'N')]
          ),
        ]);
      }
      
      graph.addEdge(shiftReturnId, readId, [
        label(
          ['tape1', r(RWALL, RWALL, 'N')],
          ['tape2', r(LWALL, LWALL, 'R')],
          ['tape3', r(t3sym, t3sym, 'N')]
        ),
      ]);
    }

    // --------------------------------------------------------
    // STANDARD SIMULATION LOGIC (Visual Bug Fixed Here)
    // --------------------------------------------------------
    for (const d of digits) {
      const simId = `D_SIM_${q}_${d}`;
      graph.addNode(simId, `Sim\n${q}\nbranch ${d}`);
      
      for (const sym of [...allSymbols, RWALL]) {
        graph.addEdge(readId, simId, [
          label(
            ['tape1', r(RWALL, RWALL, 'N')],
            ['tape2', r(sym,   sym,   'N')],
            ['tape3', r(d,     d,     'R')]
          ),
        ]);
      }

      for (const sym of allSymbols) {
        const candidates = matchingTransitions(q, sym);
        const chosen     = candidates[Number(d) - 1];

        // Dead Ends
        if (ntmNode.type === 'reject' || !chosen) {
          for (const t3sym of [...digits, BLANK]) {
            graph.addEdge(simId, RESET_START, [
              label(
                ['tape1', r(RWALL,  RWALL,  'N')],
                ['tape2', r(sym,    sym,    'N')],
                ['tape3', r(t3sym,  t3sym,  'N')]
              ),
            ]);
          }
          continue;
        }

        const { edge: ntmEdge, rule } = chosen;
        const nextStateId = `D_READ_ADDR_${ntmEdge.target}`;

        if (rule.direction === 'R') {
          // CREATE NODES ONCE PER SYMBOL (Fixes visual duplication!)
          const expandCheckId = `D_EXPAND_CHECK_${simId}_${sym}`;
          const expandReturnId = `D_EXPAND_RETURN_${simId}_${sym}`;
          
          graph.addNode(expandCheckId, `Expand\nCheck`);
          graph.addNode(expandReturnId, `Expand\nReturn`);

          for (const t3sym of [...digits, BLANK]) {
            graph.addEdge(simId, expandCheckId, [
              label(
                ['tape1', r(RWALL,      RWALL,      'N')],
                ['tape2', r(sym,        rule.write, 'R')],
                ['tape3', r(t3sym,      t3sym,      'N')]
              ),
            ]);

            for (const nextSym of allSymbols) {
              graph.addEdge(expandCheckId, nextStateId, [
                label(
                  ['tape1', r(RWALL,   RWALL,   'N')],
                  ['tape2', r(nextSym, nextSym, 'N')],
                  ['tape3', r(t3sym,   t3sym,   'N')]
                ),
              ]);
            }

            graph.addEdge(expandCheckId, expandReturnId, [
              label(
                ['tape1', r(RWALL, RWALL, 'N')],
                ['tape2', r(RWALL, BLANK, 'R')],   
                ['tape3', r(t3sym, t3sym, 'N')]
              ),
            ]);

            graph.addEdge(expandReturnId, nextStateId, [
              label(
                ['tape1', r(RWALL, RWALL, 'N')],
                ['tape2', r(BLANK, RWALL, 'L')],   
                ['tape3', r(t3sym, t3sym, 'N')]
              ),
            ]);
          }
        } else {
          // L or N direction
          for (const t3sym of [...digits, BLANK]) {
            graph.addEdge(simId, nextStateId, [
              label(
                ['tape1', r(RWALL,      RWALL,      'N')],
                ['tape2', r(sym,        rule.write, rule.direction)],
                ['tape3', r(t3sym,      t3sym,      'N')]
              ),
            ]);
          }
        }
      }
    }
  }

  // --------------------------------------------------------
  // RESET AND REWIND
  // --------------------------------------------------------
  const GOTO_LWALL      = 'D_RESET_GOTO_LWALL';
  const WIPE_T2         = 'D_RESET_WIPE_T2';
  const REWIND_T1_T2    = 'D_RESET_REWIND_T1_T2';
  const RESET_COPY      = 'D_RESET_COPY';
  const RESET_COPY_DONE = 'D_RESET_COPY_DONE';

  graph.addNode(GOTO_LWALL,      'Reset\nGoto [');
  graph.addNode(WIPE_T2,         'Reset\nWipe T2');
  graph.addNode(REWIND_T1_T2,    'Reset\nRewind\nT1+T2');
  graph.addNode(RESET_COPY,      'Reset\nCopy\nT1→T2');
  graph.addNode(RESET_COPY_DONE, 'Reset\nCopy\nDone');

  for (const d of digits) {
    for (const sym of [...allSymbols, RWALL]) {
      graph.addEdge(RESET_START, RESET_START, [
        label(
          ['tape1', r(RWALL, RWALL, 'N')],
          ['tape2', r(sym,   sym,   'N')],
          ['tape3', r(d,     d,     'R')] 
        ),
      ]);
    }
  }

  graph.addEdge(RESET_START, WIPE_T2, [
    label(
      ['tape1', r(RWALL, RWALL, 'N')],
      ['tape2', r(LWALL, LWALL, 'R')],
      ['tape3', r(BLANK, BLANK, 'N')]
    ),
  ]);

  for (const sym of [...allSymbols, RWALL]) {
    graph.addEdge(RESET_START, GOTO_LWALL, [
      label(
        ['tape1', r(RWALL, RWALL, 'N')],
        ['tape2', r(sym,   sym,   'L')],
        ['tape3', r(BLANK, BLANK, 'N')]
      ),
    ]);
  }

  for (const sym of [...inputSymbols, BLANK, RWALL]) {
    graph.addEdge(GOTO_LWALL, GOTO_LWALL, [
      label(
        ['tape1', r(RWALL, RWALL, 'N')],
        ['tape2', r(sym,   sym,   'L')],
        ['tape3', r(BLANK, BLANK, 'N')]
      ),
    ]);
  }

  graph.addEdge(GOTO_LWALL, WIPE_T2, [
    label(
      ['tape1', r(RWALL, RWALL, 'N')],
      ['tape2', r(LWALL, LWALL, 'R')],
      ['tape3', r(BLANK, BLANK, 'N')]
    ),
  ]);

  for (const sym of [...inputSymbols, BLANK]) {
    graph.addEdge(WIPE_T2, WIPE_T2, [
      label(
        ['tape1', r(RWALL, RWALL, 'N')],
        ['tape2', r(sym,   BLANK, 'R')],
        ['tape3', r(BLANK, BLANK, 'N')]
      ),
    ]);
  }

  graph.addEdge(WIPE_T2, REWIND_T1_T2, [
    label(
      ['tape1', r(RWALL, RWALL, 'L')],
      ['tape2', r(RWALL, BLANK, 'L')], 
      ['tape3', r(BLANK, BLANK, 'N')]
    ),
  ]);

  const tape1RewindSyms = [...inputSymbols, BLANK, LWALL, RWALL];
  const tape2RewindSyms = [...inputSymbols, BLANK, LWALL, RWALL];

  for (const t1 of tape1RewindSyms) {
    for (const t2 of tape2RewindSyms) {
      if (t1 === LWALL && t2 === LWALL) continue;

      const dir1 = (t1 === LWALL) ? 'N' : 'L';
      const dir2 = (t2 === LWALL) ? 'N' : 'L';

      graph.addEdge(REWIND_T1_T2, REWIND_T1_T2, [
        label(
          ['tape1', r(t1, t1, dir1)],
          ['tape2', r(t2, t2, dir2)],
          ['tape3', r(BLANK, BLANK, 'N')]
        ),
      ]);
    }
  }

  graph.addEdge(REWIND_T1_T2, RESET_COPY, [
    label(
      ['tape1', r(LWALL, LWALL, 'R')],
      ['tape2', r(LWALL, LWALL, 'R')],
      ['tape3', r(BLANK, BLANK, 'N')]
    ),
  ]);

  for (const sym of [...inputSymbols, BLANK]) {
    for (const d of [...digits, BLANK]) {
      graph.addEdge(RESET_COPY, RESET_COPY, [
        label(
          ['tape1', r(sym,   sym,   'R')],
          ['tape2', r(BLANK, sym,   'R')],
          ['tape3', r(d,     d,     'N')]
        ),
      ]);
    }
  }

  for (const d of [...digits, BLANK]) {
    for (const t2Sym of [BLANK, RWALL]) {
      graph.addEdge(RESET_COPY, RESET_COPY_DONE, [
        label(
          ['tape1', r(RWALL, RWALL, 'N')],
          ['tape2', r(t2Sym, RWALL, 'N')],
          ['tape3', r(d,     d,     'N')]
        ),
      ]);
    }
  }

  // --------------------------------------------------------
  // ADDRESS INCREMENT PHASE
  // --------------------------------------------------------
  const INC_REWIND_FIRST = 'D_INC_REWIND_FIRST';
  const INC_FIND_END    = 'D_INC_FIND_END';
  const INC_MATH        = 'D_INC_MATH';
  const INC_EXPAND      = 'D_INC_EXPAND';
  const INC_REWIND_T3   = 'D_INC_REWIND_T3';
  const INC_REWIND_T1T2 = 'D_INC_REWIND_T1_T2';

  graph.addNode(INC_REWIND_FIRST, 'Inc\nRewind T3\nFirst');
  graph.addNode(INC_FIND_END,    'Inc\nFind End');
  graph.addNode(INC_MATH,        'Inc\nMath');
  graph.addNode(INC_EXPAND,      'Inc\nExpand');
  graph.addNode(INC_REWIND_T3,   'Inc\nRewind T3');
  graph.addNode(INC_REWIND_T1T2, 'Inc\nRewind\nT2'); 

  for (const t3sym of [...digits, BLANK]) {
    graph.addEdge(RESET_COPY_DONE, INC_REWIND_FIRST, [
      label(
        ['tape1', r(RWALL,  RWALL,  'N')],
        ['tape2', r(RWALL,  RWALL,  'N')],
        ['tape3', r(t3sym,  t3sym,  'L')]
      ),
    ]);
  }

  for (const d of digits) {
    graph.addEdge(INC_REWIND_FIRST, INC_REWIND_FIRST, [
      label(
        ['tape1', r(RWALL, RWALL, 'N')],
        ['tape2', r(RWALL, RWALL, 'N')],
        ['tape3', r(d,     d,     'L')]
      ),
    ]);
  }

  graph.addEdge(INC_REWIND_FIRST, INC_FIND_END, [
    label(
      ['tape1', r(RWALL, RWALL, 'N')],
      ['tape2', r(RWALL, RWALL, 'N')],
      ['tape3', r(LWALL, LWALL, 'R')]
    ),
  ]);

  for (const d of digits) {
    graph.addEdge(INC_FIND_END, INC_FIND_END, [
      label(
        ['tape1', r(RWALL, RWALL, 'N')],
        ['tape2', r(RWALL, RWALL, 'N')],
        ['tape3', r(d,     d,     'R')]
      ),
    ]);
  }
  graph.addEdge(INC_FIND_END, INC_MATH, [
    label(
      ['tape1', r(RWALL, RWALL, 'N')],
      ['tape2', r(RWALL, RWALL, 'N')],
      ['tape3', r(BLANK, BLANK, 'L')]
    ),
  ]);

  const baseStr = String(base);
  for (let i = 1; i < base; i++) {
    graph.addEdge(INC_MATH, INC_REWIND_T3, [
      label(
        ['tape1', r(RWALL,     RWALL,       'N')],
        ['tape2', r(RWALL,     RWALL,       'N')],
        ['tape3', r(String(i), String(i+1), 'N')]
      ),
    ]);
  }

  graph.addEdge(INC_MATH, INC_MATH, [
    label(
      ['tape1', r(RWALL,   RWALL, 'N')],
      ['tape2', r(RWALL,   RWALL, 'N')],
      ['tape3', r(baseStr, '1',   'L')]
    ),
  ]);

  graph.addEdge(INC_MATH, INC_EXPAND, [
    label(
      ['tape1', r(RWALL, RWALL, 'N')],
      ['tape2', r(RWALL, RWALL, 'N')],
      ['tape3', r(LWALL, '1',   'L')]
    ),
  ]);

  graph.addEdge(INC_EXPAND, INC_REWIND_T3, [
    label(
      ['tape1', r(RWALL, RWALL, 'N')],
      ['tape2', r(RWALL, RWALL, 'N')],
      ['tape3', r(BLANK, LWALL, 'R')]
    ),
  ]);

  for (const d of digits) {
    graph.addEdge(INC_REWIND_T3, INC_REWIND_T3, [
      label(
        ['tape1', r(RWALL, RWALL, 'N')],
        ['tape2', r(RWALL, RWALL, 'N')],
        ['tape3', r(d,     d,     'L')]
      ),
    ]);
  }
  
  graph.addEdge(INC_REWIND_T3, INC_REWIND_T1T2, [
    label(
      ['tape1', r(RWALL, RWALL, 'N')],
      ['tape2', r(RWALL, RWALL, 'L')], 
      ['tape3', r(LWALL, LWALL, 'R')]
    ),
  ]);

  for (const d of digits) {
    for (const t2 of [...inputSymbols, BLANK, RWALL]) {
      graph.addEdge(INC_REWIND_T1T2, INC_REWIND_T1T2, [
        label(
          ['tape1', r(RWALL, RWALL, 'N')],
          ['tape2', r(t2,    t2,    'L')],
          ['tape3', r(d,     d,     'N')]
        ),
      ]);
    }
  }

  for (const d of digits) {
    graph.addEdge(INC_REWIND_T1T2, `D_READ_ADDR_${startOrig.id}`, [
      label(
        ['tape1', r(RWALL, RWALL, 'N')],
        ['tape2', r(LWALL, LWALL, 'R')],
        ['tape3', r(d,     d,     'N')]
      ),
    ]);
  }

  graph.mergeParallelEdges();
  
  // Garbage Collection for unreachable nodes
  const reachable = new Set();
  const bfsQueue  = [INIT]; 
  reachable.add(INIT);
  
  const adjFwd = {};
  for (const e of graph.edges) {
    if (!adjFwd[e.source]) adjFwd[e.source] = [];
    adjFwd[e.source].push(e.target);
  }
  
  while (bfsQueue.length > 0) {
    const cur = bfsQueue.shift();
    for (const nb of (adjFwd[cur] || [])) {
      if (!reachable.has(nb)) {
        reachable.add(nb);
        bfsQueue.push(nb);
      }
    }
  }
  
  graph.nodes = graph.nodes.filter(n => reachable.has(n.id));
  graph.edges = graph.edges.filter(e => reachable.has(e.source) && reachable.has(e.target));

  graph.applyLayout(INIT);

  return { nodes: graph.nodes, edges: graph.edges };
}

export function copyToTape2(tape1, head1, tape2, tape2ContentStart) {
  const fresh = tape2.slice();

  let writeIdx = tape2ContentStart;
  for (let readIdx = head1; readIdx < tape1.length; readIdx++) {
    const sym = tape1[readIdx];
    if (sym === LWALL) break;

    while (writeIdx >= fresh.length) fresh.push(BLANK);
    fresh[writeIdx] = sym;
    writeIdx++;

    if (sym === RWALL) break; 
  }

  for (let i = writeIdx; i < fresh.length; i++) {
    if (fresh[i] === RWALL || fresh[i] === BLANK) break;
    fresh[i] = BLANK;
  }

  return { tape2: fresh, head2: tape2ContentStart };
}

export function computeBase(origNodes, origEdges) {
  const counts = new Map(origNodes.map(n => [n.id, new Map()]));

  for (const edge of origEdges) {
    for (const lbl of (edge.data?.labels || [])) {
      const rule   = lbl.tape1 ?? lbl;
      const symbol = rule.read;
      if (symbol === undefined) continue;

      const stateMap = counts.get(edge.source);
      if (!stateMap) continue;
      stateMap.set(symbol, (stateMap.get(symbol) ?? 0) + 1);
    }
  }

  let max = 1;
  for (const stateMap of counts.values()) {
    for (const cnt of stateMap.values()) {
      if (cnt > max) max = cnt;
    }
  }
  return max;
}

export function buildNtmQueueTape(inputStr) {
  const PAD = 20;
  const blanks = Array(PAD).fill(BLANK);

  const inputChars = inputStr
    ? inputStr.split('').map(c => (c === ' ' ? BLANK : c))
    : [];

  const tape1 = [...blanks, LWALL, ...inputChars, RWALL, ...blanks];
  const head1  = PAD + 1;   

  const tape2 = [...blanks, LWALL, ...Array(inputChars.length + PAD).fill(BLANK)];
  const head2  = PAD + 1;   

  const tape3 = [...blanks, LWALL, BLANK, ...blanks];
  const head3  = PAD + 1;

  return {
    tapes: [tape1, tape2, tape3],
    heads: [head1, head2, head3],
  };
}

export function createDtmController(origNodes, origEdges, inputStr) {
  const base                          = computeBase(origNodes, origEdges);
  const { tapes: initTapes,
          heads: initHeads }          = buildNtmQueueTape(inputStr);

  const tape1  = initTapes[0];
  const head1  = initHeads[0];
  let tape2    = initTapes[1];
  const tape2ContentStart = initHeads[1];
  let head2    = tape2ContentStart;
  let tape3    = initTapes[2];
  const head3  = initHeads[2];

  let address  = [1];
  tape3        = addressToTape(tape3, head3, address);

  let iteration   = 0;
  let phase       = 'running';
  let lastOutcome = null;
  let lastSteps   = 0;

  function snapshot() {
    return {
      phase,
      iteration,
      address:     address.slice(),
      tapes:       [tape1.slice(), tape2.slice(), tape3.slice()],
      heads:       [head1, head2, head3],
      lastOutcome,
      lastSteps,
    };
  }

  function step() {
    if (phase !== 'running') return snapshot();

    iteration++;
    const result = simulatePath(
      origNodes, origEdges,
      tape2, head2,
      address, base,
    );

    lastOutcome = result.outcome;
    lastSteps   = result.steps;

    if (result.outcome === 'accept') {
      tape2 = result.tape2;
      head2 = result.head2;
      phase = 'accept';
      return snapshot();
    }

    ({ tape2, head2 } = copyToTape2(tape1, head1, tape2, tape2ContentStart));
    address = incrementAddress(address, base);
    tape3 = addressToTape(tape3, head3, address);

    return snapshot();
  }

  function run(maxIterations = 100_000) {
    while (phase === 'running' && iteration < maxIterations) {
      step();
    }
    if (phase === 'running') {
      phase = 'limit';
    }
    return snapshot();
  }

  return { step, run, snapshot };
}