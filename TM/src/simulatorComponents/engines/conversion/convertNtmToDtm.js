const BLANK      = '␣';
const LWALL      = '[';
const RWALL      = ']';
const VALID_FLAG = '{'; 

function makeNode(id, label, type = 'normal') {
  return { id, type, position: { x: 0, y: 0 }, data: { label } };
}

let edgeCounter = 0;

function makeEdge(source, target, labels) {
  return {
    id: `e_${source}_${target}_${edgeCounter++}`,
    type: 'draggable',
    source,
    target,
    markerEnd: { type: 'arrowclosed', color: '#333' },
    data: { labels, t: 0.5 },
  };
}

function r(read, write, direction) { return { read, write, direction }; }

function label(...tapeRules) {
  return Object.fromEntries(tapeRules);
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
    for (const n of this.nodes) (byLevel[levels[n.id] ?? 0] ||= []).push(n);

    const X_GAP = 280, Y_GAP = 150;
    for (const [lv, grp] of Object.entries(byLevel)) {
      const totalH = (grp.length - 1) * Y_GAP;
      grp.forEach((n, i) => { n.position = { x: Number(lv) * X_GAP, y: i * Y_GAP - totalH / 2 }; });
    }
  }
}

function buildAlphabet(origEdges) {
  const alpha = new Set([BLANK, LWALL]);
  for (const edge of origEdges)
    for (const lbl of (edge.data?.labels || []))
      for (const key of ['read', 'write'])
        if (lbl[key]) alpha.add(lbl[key]);
  return alpha;
}

export function computeBase(origNodes, origEdges) {
  const counts = new Map(origNodes.map(n => [n.id, new Map()]));
  for (const edge of origEdges) {
    for (const lbl of (edge.data?.labels || [])) {
      const symbol = (lbl.tape1 ?? lbl).read;
      if (symbol === undefined) continue;
      const sm = counts.get(edge.source);
      if (sm) sm.set(symbol, (sm.get(symbol) ?? 0) + 1);
    }
  }
  let max = 1;
  for (const sm of counts.values())
    for (const cnt of sm.values())
      if (cnt > max) max = cnt;
  return max;
}

export function incrementAddress(address, base, pruneDepth = -1) {
  if (base < 1) throw new RangeError('base must be at least 1');
  const next = address.slice();

  let startIndex = next.length - 1;

  if (pruneDepth >= 0 && pruneDepth < next.length) {
    startIndex = pruneDepth;
    for (let i = pruneDepth + 1; i < next.length; i++) next[i] = 1;
  }

  for (let i = startIndex; i >= 0; i--) {
    if (next[i] < base) { next[i]++; return next; }
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
  for (let j = 0; j < address.length; j++) updated[headStart + j] = String(address[j]);
  return updated;
}

function applyTapeAction(tape, head, write, direction) {
  const next = tape.slice();
  next[head] = write;
  let newHead = direction === 'R' ? head + 1 : direction === 'L' ? Math.max(0, head - 1) : head;

  if (newHead >= next.length) next.push(BLANK);

  if (direction === 'R' && next[newHead] === RWALL) {
    if (newHead + 1 >= next.length) next.push(BLANK);
    next[newHead + 1] = RWALL;
    next[newHead]     = BLANK;
  }
  if (direction === 'L' && (next[newHead] === LWALL || next[newHead] === VALID_FLAG)) {
    next.splice(newHead + 1, 0, BLANK);
    newHead++;
  }
  return [next, newHead];
}

function buildAdjOut(nodes, edges) {
  const adj = new Map(nodes.map(n => [n.id, []]));
  for (const e of edges) adj.get(e.source)?.push(e);
  return adj;
}

function matchingTransitions(adjOut, stateId, symbol) {
  return (adjOut.get(stateId) || []).flatMap(edge =>
    (edge.data?.labels || [])
      .filter(lbl => (lbl.tape1 ?? lbl).read === symbol)
      .map(lbl => ({ edge, rule: lbl.tape1 ?? lbl }))
  );
}

export function simulatePath(nodeById, adjOut, startNode, tape2, head2, address, base) {
  if (!startNode) return { outcome: 'reject', tape2, head2, steps: 0, pruneDepth: -1 };

  let currentState = startNode.id;
  let currentTape  = tape2.slice();
  let currentHead  = head2;
  let steps        = 0;

  for (let addrIdx = 0; addrIdx < address.length; addrIdx++) {
    const chosenBranch = address[addrIdx];
    const stateNode = nodeById.get(currentState);
    if (!stateNode)                   return { outcome: 'reject', tape2: currentTape, head2: currentHead, steps, pruneDepth: -1 };
    if (stateNode.type === 'accept')  return { outcome: 'accept', tape2: currentTape, head2: currentHead, steps, pruneDepth: -1 };
    if (stateNode.type === 'reject')  return { outcome: 'reject', tape2: currentTape, head2: currentHead, steps, pruneDepth: addrIdx };

    let symbol = currentTape[currentHead] ?? BLANK;
    if (symbol === RWALL) symbol = BLANK;

    const candidates = matchingTransitions(adjOut, currentState, symbol);
    if (!candidates.length || chosenBranch < 1 || chosenBranch > candidates.length)
      return { outcome: 'reject', tape2: currentTape, head2: currentHead, steps, pruneDepth: addrIdx };

    const { edge, rule } = candidates[chosenBranch - 1];
    [currentTape, currentHead] = applyTapeAction(currentTape, currentHead, rule.write, rule.direction);
    currentState = edge.target;
    steps++;
  }

  const finalNode = nodeById.get(currentState);
  return {
    outcome: finalNode?.type === 'accept' ? 'accept' : 'reject',
    tape2: currentTape,
    head2: currentHead,
    steps,
    pruneDepth: -1, 
  };
}

function addT3Loop(graph, src, tgt, t3syms, t2Rule, t1Rule = r(RWALL, RWALL, 'N')) {
  for (const t3sym of t3syms) {
    graph.addEdge(src, tgt, [
      label(['tape1', t1Rule], ['tape2', t2Rule], ['tape3', r(t3sym, t3sym, 'N')]),
    ]);
  }
}

export function convertNtmToDtm(origNodes, origEdges) {
  const startOrig = origNodes.find(n => n.type === 'start');
  if (!startOrig) return { nodes: [], edges: [] };

  const alpha        = buildAlphabet(origEdges);
  const inputSymbols = [...alpha].filter(s => s !== BLANK && s !== LWALL && s !== RWALL);
  const allSymbols   = [...inputSymbols, BLANK];
  const base         = computeBase(origNodes, origEdges);
  const digits       = Array.from({ length: base }, (_, i) => String(i + 1));
  const digitsBlank  = [...digits, BLANK];
  const deadDigits   = digits.map(d => `${d}^`);

  const graph = new GraphBuilder();

  const INIT   = 'D_INIT';
  const COPY   = 'D_S1_COPY';
  const REWIND = 'D_S1_REWIND';

  graph.addNode(INIT,   'INIT',          'start');
  graph.addNode(COPY,   'S1\nCopy\nT1→T2');
  graph.addNode(REWIND, 'S1\nRewind\nT2');

  for (const sym of allSymbols) {
    graph.addEdge(INIT, COPY, [label(
      ['tape1', r(sym,   sym,   'N')],
      ['tape2', r(BLANK, BLANK, 'N')],
      ['tape3', r(BLANK, '1',   'N')],
    )]);
    graph.addEdge(COPY, COPY, [label(
      ['tape1', r(sym, sym, 'R')],
      ['tape2', r(BLANK, sym, 'R')],
      ['tape3', r('1', '1', 'N')],
    )]);
  }

  graph.addEdge(COPY, REWIND, [label(
    ['tape1', r(RWALL, RWALL, 'N')],
    ['tape2', r(BLANK, RWALL, 'N')],
    ['tape3', r('1',   '1',   'N')],
  )]);

  for (const sym of [...inputSymbols, BLANK, RWALL]) {
    graph.addEdge(REWIND, REWIND, [label(
      ['tape1', r(RWALL, RWALL, 'N')],
      ['tape2', r(sym,   sym,   'L')],
      ['tape3', r('1',   '1',   'N')],
    )]);
  }

  for (const d of digits) {
    graph.addEdge(REWIND, `D_READ_ADDR_${startOrig.id}`, [label(
      ['tape1', r(RWALL, RWALL, 'N')],
      ['tape2', r(LWALL, LWALL, 'R')],
      ['tape3', r(d,     d,     'N')],
    )]);
  }

  const adjOut = buildAdjOut(origNodes, origEdges);

  const RESET_START = 'D_RESET_START';
  const D_ACCEPT    = 'D_ACCEPT';
  graph.addNode(RESET_START, 'Reset\nStart');
  graph.addNode(D_ACCEPT,    'ACCEPT', 'accept');

  for (const ntmNode of origNodes) {
    const q      = ntmNode.id;
    const readId = `D_READ_ADDR_${q}`;
    graph.addNode(readId, `Read\nAddr`);

    if (ntmNode.type === 'accept') {
      for (const sym of allSymbols)
        addT3Loop(graph, readId, D_ACCEPT, digitsBlank, r(sym, sym, 'N'));
      continue;
    }

    const survRewindId = `D_SURV_REWIND_${q}`;
    graph.addNode(survRewindId, 'Survive\nRewind');

    for (const sym of [...allSymbols, RWALL]) {
      graph.addEdge(readId, survRewindId, [label(
        ['tape1', r(RWALL, RWALL,       'N')],
        ['tape2', r(sym,   sym,         'N')],
        ['tape3', r(BLANK, BLANK,       'L')], 
      )]);
    }

    for (const d of [...digits, ...deadDigits]) {
      for (const sym of [...allSymbols, RWALL]) {
        graph.addEdge(survRewindId, survRewindId, [label(
          ['tape1', r(RWALL, RWALL, 'N')],
          ['tape2', r(sym,   sym,   'N')],
          ['tape3', r(d,     d,     'L')],
        )]);
      }
    }

    for (const wall of [LWALL, VALID_FLAG]) {
      for (const sym of [...allSymbols, RWALL]) {
        graph.addEdge(survRewindId, RESET_START, [label(
          ['tape1', r(RWALL,       RWALL,      'N')],
          ['tape2', r(sym,         sym,        'N')],
          ['tape3', r(wall,        VALID_FLAG, 'R')], 
        )]);
      }
    }

    const shiftSymbols  = [...allSymbols, RWALL];
    const shiftStartId  = `D_SHIFT_START_${q}`;
    const shiftReturnId = `D_SHIFT_RETURN_${q}`;
    graph.addNode(shiftStartId,  `Shift\nStart`);
    graph.addNode(shiftReturnId, `Shift\nReturn`);

    addT3Loop(graph, readId, shiftStartId, digitsBlank, r(LWALL,      LWALL,      'R'));
    addT3Loop(graph, readId, shiftStartId, digitsBlank, r(VALID_FLAG, VALID_FLAG, 'R'));

    for (const t3sym of [...digitsBlank, VALID_FLAG]) {
      for (const sym of shiftSymbols) {
        const carryId = `D_SHIFT_CARRY_${q}_${sym}`;
        graph.addNode(carryId, `Carry\n${sym}`);
        graph.addEdge(shiftStartId, carryId, [label(
          ['tape1', r(RWALL, RWALL, 'N')],
          ['tape2', r(sym,   BLANK, 'R')],
          ['tape3', r(t3sym, t3sym, 'N')],
        )]);

        if (sym === RWALL) {
          graph.addEdge(carryId, shiftReturnId, [label(
            ['tape1', r(RWALL, RWALL, 'N')],
            ['tape2', r(BLANK, RWALL, 'L')],
            ['tape3', r(t3sym, t3sym, 'N')],
          )]);
        } else {
          for (const tapeSym of shiftSymbols) {
            graph.addEdge(carryId, `D_SHIFT_CARRY_${q}_${tapeSym}`, [label(
              ['tape1', r(RWALL,   RWALL,    'N')],
              ['tape2', r(tapeSym, sym,      'R')],
              ['tape3', r(t3sym,   t3sym,    'N')],
            )]);
          }
        }
      }
    }

    for (const t3sym of [...digitsBlank, VALID_FLAG]) {
      for (const sym of shiftSymbols) {
        graph.addEdge(shiftReturnId, shiftReturnId, [label(
          ['tape1', r(RWALL, RWALL, 'N')],
          ['tape2', r(sym,   sym,   'L')],
          ['tape3', r(t3sym, t3sym, 'N')],
        )]);
      }
      graph.addEdge(shiftReturnId, readId, [label(
        ['tape1', r(RWALL, RWALL, 'N')],
        ['tape2', r(LWALL, LWALL, 'R')],
        ['tape3', r(t3sym, t3sym, 'N')],
      )]);
    }

    for (const d of digits) {
      const simId = `D_SIM_${q}_${d}`;
      graph.addNode(simId, `Sim\nbranch ${d}`);

      for (const sym of [...allSymbols, RWALL]) {
        graph.addEdge(readId, simId, [label(
          ['tape1', r(RWALL, RWALL, 'N')],
          ['tape2', r(sym,   sym,   'N')],
          ['tape3', r(d,     d,     'R')],
        )]);
      }

      for (const sym of allSymbols) {
        const candidates  = matchingTransitions(adjOut, q, sym);
        const chosen      = candidates[Number(d) - 1];

        if (ntmNode.type === 'reject' || !chosen) {
          const markId = `D_MARK_${simId}_${sym}`;
          graph.addNode(markId, `Mark\n${d}^`);
          for (const t3sym of digitsBlank) {
            graph.addEdge(simId, markId, [label(
              ['tape1', r(RWALL, RWALL, 'N')],
              ['tape2', r(sym,   sym,   'N')],
              ['tape3', r(t3sym, t3sym, 'L')],
            )]);
            graph.addEdge(markId, RESET_START, [label(
              ['tape1', r(RWALL, RWALL, 'N')],
              ['tape2', r(sym,   sym,   'N')],
              ['tape3', r(t3sym, `${d}^`, 'R')],
            )]);
          }
          continue;
        }

        const { edge: ntmEdge, rule } = chosen;
        const nextStateId = `D_READ_ADDR_${ntmEdge.target}`;

        if (rule.direction === 'R') {
          const expandCheckId  = `D_EXPAND_CHECK_${simId}_${sym}`;
          const expandReturnId = `D_EXPAND_RETURN_${simId}_${sym}`;
          graph.addNode(expandCheckId,  'Expand\nCheck');
          graph.addNode(expandReturnId, 'Expand\nReturn');

          addT3Loop(graph, simId, expandCheckId, digitsBlank, r(sym, rule.write, 'R'));
          for (const nextSym of allSymbols)
            addT3Loop(graph, expandCheckId, nextStateId, digitsBlank, r(nextSym, nextSym, 'N'));
          addT3Loop(graph, expandCheckId,  expandReturnId, digitsBlank, r(RWALL, BLANK, 'R'));
          addT3Loop(graph, expandReturnId, nextStateId,    digitsBlank, r(BLANK, RWALL, 'L'));
        } else {
          addT3Loop(graph, simId, nextStateId, digitsBlank, r(sym, rule.write, rule.direction));
        }
      }
    }
  }

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

  for (const d of [...digits, ...deadDigits])
    for (const sym of [...allSymbols, RWALL])
      graph.addEdge(RESET_START, RESET_START, [label(
        ['tape1', r(RWALL, RWALL, 'N')],
        ['tape2', r(sym,   sym,   'N')],
        ['tape3', r(d,     d,     'R')],
      )]);

  graph.addEdge(RESET_START, WIPE_T2, [label(
    ['tape1', r(RWALL, RWALL, 'N')],
    ['tape2', r(LWALL, LWALL, 'R')],
    ['tape3', r(BLANK, BLANK, 'N')],
  )]);

  for (const sym of [...allSymbols, RWALL]) {
    graph.addEdge(RESET_START, GOTO_LWALL, [label(
      ['tape1', r(RWALL, RWALL, 'N')],
      ['tape2', r(sym,   sym,   'L')],
      ['tape3', r(BLANK, BLANK, 'N')],
    )]);
    graph.addEdge(GOTO_LWALL, GOTO_LWALL, [label(
      ['tape1', r(RWALL, RWALL, 'N')],
      ['tape2', r(sym,   sym,   'L')],
      ['tape3', r(BLANK, BLANK, 'N')],
    )]);
  }

  graph.addEdge(GOTO_LWALL, WIPE_T2, [label(
    ['tape1', r(RWALL, RWALL, 'N')],
    ['tape2', r(LWALL, LWALL, 'R')],
    ['tape3', r(BLANK, BLANK, 'N')],
  )]);

  for (const sym of allSymbols) {
    graph.addEdge(WIPE_T2, WIPE_T2, [label(
      ['tape1', r(RWALL, RWALL, 'N')],
      ['tape2', r(sym,   BLANK, 'R')],
      ['tape3', r(BLANK, BLANK, 'N')],
    )]);
  }

  graph.addEdge(WIPE_T2, REWIND_T1_T2, [label(
    ['tape1', r(RWALL, RWALL, 'L')],
    ['tape2', r(RWALL, BLANK, 'L')],
    ['tape3', r(BLANK, BLANK, 'N')],
  )]);

  const rewindSyms = [...inputSymbols, BLANK, LWALL, RWALL];
  for (const t1 of rewindSyms) {
    for (const t2 of rewindSyms) {
      if (t1 === LWALL && t2 === LWALL) continue;
      graph.addEdge(REWIND_T1_T2, REWIND_T1_T2, [label(
        ['tape1', r(t1, t1, t1 === LWALL ? 'N' : 'L')],
        ['tape2', r(t2, t2, t2 === LWALL ? 'N' : 'L')],
        ['tape3', r(BLANK, BLANK, 'N')],
      )]);
    }
  }

  graph.addEdge(REWIND_T1_T2, RESET_COPY, [label(
    ['tape1', r(LWALL, LWALL, 'R')],
    ['tape2', r(LWALL, LWALL, 'R')],
    ['tape3', r(BLANK, BLANK, 'N')],
  )]);

  for (const sym of allSymbols)
    for (const d of digitsBlank)
      graph.addEdge(RESET_COPY, RESET_COPY, [label(
        ['tape1', r(sym,   sym,   'R')],
        ['tape2', r(BLANK, sym,   'R')],
        ['tape3', r(d,     d,     'N')],
      )]);

  for (const d of digitsBlank)
    for (const t2Sym of [BLANK, RWALL])
      graph.addEdge(RESET_COPY, RESET_COPY_DONE, [label(
        ['tape1', r(RWALL, RWALL, 'N')],
        ['tape2', r(t2Sym, RWALL, 'N')],
        ['tape3', r(d,     d,     'N')],
      )]);

  const INC_REWIND_FIRST = 'D_INC_REWIND_FIRST';
  const INC_FIND_END     = 'D_INC_FIND_END';
  const INC_MATH         = 'D_INC_MATH';
  const INC_EXPAND       = 'D_INC_EXPAND';
  const INC_REWIND_T3    = 'D_INC_REWIND_T3';
  const INC_REWIND_T1T2  = 'D_INC_REWIND_T1_T2';

  graph.addNode(INC_REWIND_FIRST, 'Inc\nRewind T3\nFirst');
  graph.addNode(INC_FIND_END,     'Inc\nFind End');
  graph.addNode(INC_MATH,         'Inc\nMath');
  graph.addNode(INC_EXPAND,       'Inc\nExpand');
  graph.addNode(INC_REWIND_T3,    'Inc\nRewind T3');
  graph.addNode(INC_REWIND_T1T2,  'Inc\nRewind\nT2');

  const t1t2Stay = r(RWALL, RWALL, 'N'); 

  for (const t3sym of digitsBlank)
    graph.addEdge(RESET_COPY_DONE, INC_REWIND_FIRST, [label(
      ['tape1', t1t2Stay], ['tape2', t1t2Stay], ['tape3', r(t3sym, t3sym, 'L')],
    )]);

  for (const d of [...digits, ...deadDigits])
    graph.addEdge(INC_REWIND_FIRST, INC_REWIND_FIRST, [label(
      ['tape1', t1t2Stay], ['tape2', t1t2Stay], ['tape3', r(d, d, 'L')],
    )]);

  graph.addEdge(INC_REWIND_FIRST, INC_FIND_END, [label(
    ['tape1', t1t2Stay], ['tape2', t1t2Stay], ['tape3', r(LWALL,      LWALL,      'R')],
  )]);
  graph.addEdge(INC_REWIND_FIRST, INC_FIND_END, [label(
    ['tape1', t1t2Stay], ['tape2', t1t2Stay], ['tape3', r(VALID_FLAG, VALID_FLAG, 'R')],
  )]);

  for (const d of digits)
    graph.addEdge(INC_FIND_END, INC_FIND_END, [label(
      ['tape1', t1t2Stay], ['tape2', t1t2Stay], ['tape3', r(d, d, 'R')],
    )]);

  graph.addEdge(INC_FIND_END, INC_MATH, [label(
    ['tape1', t1t2Stay], ['tape2', t1t2Stay], ['tape3', r(BLANK, BLANK, 'L')],
  )]);

  const INC_WIPE_RIGHT  = 'D_INC_WIPE_RIGHT';
  const INC_WIPE_RETURN = 'D_INC_WIPE_RETURN';
  graph.addNode(INC_WIPE_RIGHT,  'Inc\nWipe Right');
  graph.addNode(INC_WIPE_RETURN, 'Inc\nWipe Return');

  for (const dead of deadDigits) {
    graph.addEdge(INC_FIND_END, INC_WIPE_RIGHT, [label(
      ['tape1', t1t2Stay], ['tape2', t1t2Stay], ['tape3', r(dead, dead, 'R')],
    )]);
  }

  for (const d of digits) {
    graph.addEdge(INC_WIPE_RIGHT, INC_WIPE_RIGHT, [label(
      ['tape1', t1t2Stay], ['tape2', t1t2Stay], ['tape3', r(d, '1', 'R')],
    )]);
  }

  graph.addEdge(INC_WIPE_RIGHT, INC_WIPE_RETURN, [label(
    ['tape1', t1t2Stay], ['tape2', t1t2Stay], ['tape3', r(BLANK, BLANK, 'L')],
  )]);

  graph.addEdge(INC_WIPE_RETURN, INC_WIPE_RETURN, [label(
    ['tape1', t1t2Stay], ['tape2', t1t2Stay], ['tape3', r('1', '1', 'L')],
  )]);

  for (const dead of deadDigits) {
    graph.addEdge(INC_WIPE_RETURN, INC_MATH, [label(
      ['tape1', t1t2Stay], ['tape2', t1t2Stay], ['tape3', r(dead, dead, 'N')],
    )]);
  }

  for (let i = 1; i < base; i++) {
    graph.addEdge(INC_MATH, INC_REWIND_T3, [label(
      ['tape1', t1t2Stay], ['tape2', t1t2Stay], ['tape3', r(String(i), String(i + 1), 'N')],
    )]);
    graph.addEdge(INC_MATH, INC_REWIND_T3, [label(
      ['tape1', t1t2Stay], ['tape2', t1t2Stay], ['tape3', r(`${i}^`, String(i + 1), 'N')],
    )]);
  }

  graph.addEdge(INC_MATH, INC_MATH, [label(
    ['tape1', t1t2Stay], ['tape2', t1t2Stay], ['tape3', r(String(base), '1', 'L')],
  )]);
  graph.addEdge(INC_MATH, INC_MATH, [label(
    ['tape1', t1t2Stay], ['tape2', t1t2Stay], ['tape3', r(`${base}^`, '1', 'L')],
  )]);

  graph.addEdge(INC_MATH, INC_EXPAND, [label(
    ['tape1', t1t2Stay], ['tape2', t1t2Stay], ['tape3', r(VALID_FLAG, '1', 'L')],
  )]);
  
  graph.addEdge(INC_EXPAND, INC_REWIND_T3, [label(
    ['tape1', t1t2Stay], ['tape2', t1t2Stay], ['tape3', r(BLANK, LWALL, 'R')],
  )]);

  for (const d of [...digits, ...deadDigits])
    graph.addEdge(INC_REWIND_T3, INC_REWIND_T3, [label(
      ['tape1', t1t2Stay], ['tape2', t1t2Stay], ['tape3', r(d, d, 'L')],
    )]);

  graph.addEdge(INC_REWIND_T3, INC_REWIND_T1T2, [label(
    ['tape1', t1t2Stay], ['tape2', r(RWALL, RWALL, 'L')], ['tape3', r(LWALL,      LWALL,      'R')],
  )]);
  graph.addEdge(INC_REWIND_T3, INC_REWIND_T1T2, [label(
    ['tape1', t1t2Stay], ['tape2', r(RWALL, RWALL, 'L')], ['tape3', r(VALID_FLAG, VALID_FLAG, 'R')],
  )]);

  for (const d of [...digits, ...deadDigits])
    for (const t2 of [...inputSymbols, BLANK, RWALL]) {
      graph.addEdge(INC_REWIND_T1T2, INC_REWIND_T1T2, [label(
        ['tape1', t1t2Stay], ['tape2', r(t2, t2, 'L')], ['tape3', r(d, d, 'N')],
      )]);
    }

  for (const d of [...digits, ...deadDigits]) {
    graph.addEdge(INC_REWIND_T1T2, `D_READ_ADDR_${startOrig.id}`, [label(
      ['tape1', t1t2Stay], ['tape2', r(LWALL, LWALL, 'R')], ['tape3', r(d, d, 'N')],
    )]);
  }

  graph.addEdge(INC_REWIND_T1T2, `D_READ_ADDR_${startOrig.id}`, [label(
    ['tape1', t1t2Stay], ['tape2', r(LWALL, LWALL, 'R')], ['tape3', r(VALID_FLAG, VALID_FLAG, 'N')],
  )]);

  graph.mergeParallelEdges();

  const adjFwd   = {};
  for (const e of graph.edges) (adjFwd[e.source] ||= []).push(e.target);
  const reachable = new Set([INIT]);
  const bfsQ      = [INIT];
  while (bfsQ.length) {
    for (const nb of (adjFwd[bfsQ.shift()] || []))
      if (!reachable.has(nb)) { reachable.add(nb); bfsQ.push(nb); }
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
    fresh[writeIdx++] = sym;
    if (sym === RWALL) break;
  }
  for (let i = writeIdx; i < fresh.length; i++) {
    if (fresh[i] === RWALL || fresh[i] === BLANK) break;
    fresh[i] = BLANK;
  }
  return { tape2: fresh, head2: tape2ContentStart };
}

export function buildNtmQueueTape(inputStr) {
  const PAD        =40;
  const blanks     = Array(PAD).fill(BLANK);
  const inputChars = inputStr
    ? inputStr.split('').map(c => (c === ' ' ? BLANK : c))
    : [];

  return {
    tapes: [
      [...blanks, LWALL, ...inputChars, RWALL, ...blanks],
      [...blanks, LWALL, ...Array(inputChars.length + PAD).fill(BLANK)],
      [...blanks, LWALL, BLANK, ...blanks],
    ],
    heads: [PAD + 1, PAD + 1, PAD + 1],
  };
}

export function createDtmController(origNodes, origEdges, inputStr) {
  const base                  = computeBase(origNodes, origEdges);
  const { tapes, heads }      = buildNtmQueueTape(inputStr);
  const [tape1, initTape2, initTape3] = tapes;
  const [head1, tape2ContentStart, head3] = heads;

  const nodeById  = new Map(origNodes.map(n => [n.id, n]));
  const adjOut    = buildAdjOut(origNodes, origEdges);
  const startNode = origNodes.find(n => n.type === 'start');

  let tape2              = initTape2;
  let head2              = tape2ContentStart;
  let tape3              = addressToTape(initTape3, head3, [1]);
  let address            = [1];
  let iteration          = 0;
  let phase              = 'running';
  let lastOutcome        = null;
  let lastSteps          = 0;
  let validPathThisDepth = false;

  const snapshot = () => ({
    phase, iteration,
    address:     address.slice(),
    tapes:       [tape1.slice(), tape2.slice(), tape3.slice()],
    heads:       [head1, head2, head3],
    lastOutcome, lastSteps,
  });

  function step() {
    if (phase !== 'running') return snapshot();
    iteration++;

    const result  = simulatePath(nodeById, adjOut, startNode, tape2, head2, address, base);
    lastOutcome   = result.outcome;
    lastSteps     = result.steps;

    if (result.outcome === 'accept') {
      tape2 = result.tape2;
      head2 = result.head2;
      phase = 'accept';
      return snapshot();
    }

    if (result.pruneDepth === -1) validPathThisDepth = true;

    ({ tape2, head2 } = copyToTape2(tape1, head1, tape2, tape2ContentStart));

    const nextAddress = incrementAddress(address, base, result.pruneDepth);

    if (nextAddress.length > address.length) {
      if (!validPathThisDepth) {
        phase = 'reject';
        return snapshot();
      }
      validPathThisDepth = false;
    }

    address = nextAddress;
    tape3   = addressToTape(tape3, head3, address);
    return snapshot();
  }

  function run(maxIterations = 100_000) {
    while (phase === 'running' && iteration < maxIterations) step();
    if (phase === 'running') phase = 'limit';
    return snapshot();
  }

  return { step, run, snapshot };
}