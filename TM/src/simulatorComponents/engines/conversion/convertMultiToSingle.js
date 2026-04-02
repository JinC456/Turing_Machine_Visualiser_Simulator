const BLANK  = '␣';
const DELIM  = '|';
const MARKER = '☒';


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

// A single transition rule
function rule(read, write, direction) {
  return { read, write, direction };
}


// State-ID key

const keys = {
  scan:        (stateId, scanned)             => `scan__${stateId}__${scanned.join(',')}`,
  rewindDec:   (stateId, tuple, step)         => `rwdDec__${stateId}__${tuple.join('')}__${step}`,
  update:      (stateId, edgeId, tuple, tIdx) => `update__${stateId}__${edgeId}__${tuple.join('')}__${tIdx}`,
  placeHat:    (stateId, edgeId, tuple, tIdx) => `placeHat__${stateId}__${edgeId}__${tuple.join('')}__${tIdx}`,
  afterUpdate: (stateId, edgeId, tuple, tIdx) => `afterUpdate__${stateId}__${edgeId}__${tuple.join('')}__${tIdx}`,
  rewindFinal: (targetId, step)               => `rewind__${targetId}__${step}`,

  // shift subroutine states
  shiftMark:   (ctx)                      => `shiftMark__${ctx}`,
  shiftMarkL:  (ctx)                      => `shiftMarkL__${ctx}`,
  shiftCarry:  (ctx, sym, delimZone)      => `shiftCarry_${sym}_D${delimZone}__${ctx}`,
  shiftFinish: (ctx)                      => `shiftFinish__${ctx}`,
  shiftReturn: (ctx, delimZone)           => `shiftReturn_D${delimZone}__${ctx}`,
  shiftDone:   (ctx)                      => `shiftDone__${ctx}`,
};

// Returns the highest num of tape across all edge labels
function detectNumTapes(mtEdges) {
  let numTapes = 1;
  for (const edge of mtEdges) {
    for (const label of (edge.data?.labels || [])) {
      for (const key of Object.keys(label)) {
        if (key.startsWith('tape')) {
          const n = parseInt(key.replace('tape', ''), 10);
          if (!isNaN(n)) numTapes = Math.max(numTapes, n);
        }
      }
    }
  }
  return numTapes;
}

// Builds a map from node id → node object
function buildNodeMap(mtNodes) {
  return Object.fromEntries(mtNodes.map(n => [n.id, n]));
}

// Builds a map of {edgeId, target, label} for every label on every edge
function buildTransitionMap(mtNodes, mtEdges) {
  const map = Object.fromEntries(mtNodes.map(n => [n.id, []]));
  for (const edge of mtEdges) {
    for (const label of (edge.data?.labels || [])) {
      if (!map[edge.source]) map[edge.source] = [];
      map[edge.source].push({ edgeId: edge.id, target: edge.target, label });
    }
  }
  return map;
}

// Collects every symbol that appears on all tapes, then derives the ^ version from it

function buildAlphabets(mtEdges, numTapes) {
  const alphabet = new Set([BLANK]);
  for (const edge of mtEdges) {
    for (const label of (edge.data?.labels || [])) {
      for (let t = 1; t <= numTapes; t++) {
        const td = label[`tape${t}`];
        if (td?.read)  alphabet.add(td.read);
        if (td?.write) alphabet.add(td.write);
      }
    }
  }
  const hatSymbols = new Set([...alphabet].map(s => '^' + s));
  return { alphabet, hatSymbols };
}


class GraphBuilder {
  constructor() {
    this.nodes    = [];
    this.edges    = [];
    this._created = new Set();
  }

  // Adds a node only if its id hasn't been seen before
  addNode(id, label, type = 'normal') {
    if (!this._created.has(id)) {
      this.nodes.push(makeNode(id, label, type));
      this._created.add(id);
    }
  }

  addEdge(source, target, labels) {
    this.edges.push(makeEdge(source, target, labels));
  }

  // Adds a self-loop
  addLoop(stateId, sym, dir = 'R') {
    this.addEdge(stateId, stateId, [rule(sym, sym, dir)]);
  }

  //Merges edges sharing the same source→target into one edge
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
        if (!seen.has(sig)) {
          seen.add(sig);
          merged.data.labels.push(lbl);
        }
      }
    }

    this.edges = [...edgeMap.values()];
  }

  //Assigns (x, y) positions via a BFS level layout rooted at rootId unreachable Nodes are placed at level 0

  applyLayout(rootId) {
    const levels = { [rootId]: 0 };
    const queue  = [rootId];
    const adj    = {};
    for (const e of this.edges) {
      (adj[e.source] ||= []).push(e.target);
    }
    while (queue.length > 0) {
      const cur = queue.shift();
      for (const nb of (adj[cur] || [])) {
        if (levels[nb] === undefined) {
          levels[nb] = levels[cur] + 1;
          queue.push(nb);
        }
      }
    }

    const levelCounts = {};
    const levelIndex  = {};
    for (const n of this.nodes) {
      const lv = levels[n.id] ?? 0;
      levelCounts[lv] = (levelCounts[lv] || 0) + 1;
    }
    for (const n of this.nodes) {
      const lv    = levels[n.id] ?? 0;
      const idx   = (levelIndex[lv] = (levelIndex[lv] ?? 0));
      const total = levelCounts[lv];
      n.position  = { x: (idx - (total - 1) / 2) * 220, y: lv * 150 - 100 };
      levelIndex[lv]++;
    }
  }
}


// Moves right along the tape, picking up ^ symbols to record what’s been read, while skipping everything else.
function buildScanPhase({
  origStateId, scannedSoFar, origNodeMap, origTransitions,
  numTapes, alphabet, hatSymbols, graph, queue, visited,
}) {
  const tapeZone   = scannedSoFar.length;
  const currScanId = keys.scan(origStateId, scannedSoFar);
  const stateLabel = origNodeMap[origStateId]?.data?.label || origStateId;

  // Only branch on hat symbols whose value is actually read on this tape
  const relevantReads = new Set(
    (origTransitions[origStateId] || [])
      .map(({ label }) => label[`tape${tapeZone + 1}`]?.read)
      .filter(Boolean)
  );

  for (const sym of [...alphabet, ...hatSymbols, DELIM]) {
    const isHat      = sym.startsWith('^');
    const underlying = isHat ? sym.slice(1) : null;

    if (isHat && relevantReads.has(underlying)) {
      // Branch: record this symbol and continue scanning the rest of the tape
      const newScanned = [...scannedSoFar, underlying];
      const nextScanId = keys.scan(origStateId, newScanned);
      const vKey       = `${origStateId}|${newScanned.join(',')}`;

      if (!visited.has(vKey)) {
        visited.add(vKey);
        queue.push({ origStateId, scannedSoFar: newScanned });
      }

      graph.addNode(nextScanId, `scan\n${stateLabel}\n[${newScanned.join(',')}]`);
      graph.addEdge(currScanId, nextScanId, [rule(sym, sym, 'R')]);
    } else {
      graph.addLoop(currScanId, sym, 'R');
    }
  }
}

// Finds the first transition from a state that matches the current tape reads
function findMatchingTransition(origStateId, readTuple, origTransitions, numTapes) {
  return (origTransitions[origStateId] || []).find(({ label }) =>
    Array.from({ length: numTapes }, (_, i) => {
      const td  = label[`tape${i + 1}`];
      const got = readTuple[i] ?? BLANK;
      return td && (td.read === got || (td.read === BLANK && got === BLANK));
    }).every(Boolean)
  );
}

//Once all heads are scanned, sweeps left back to the start of tape 1 so the UPDATE phase can begin scanning for hat symbols.

function buildRewindToTape1({
  lastScanId, origStateId, readTuple, upIds,
  numTapes, alphabet, hatSymbols, graph,
}) {
  // scanToEnd sweeps R to the closing DELIM
  const scanToEndId = keys.rewindDec(origStateId, readTuple, 'scanToEnd'); 
  graph.addNode(scanToEndId, `scanToEnd\nt${numTapes}`);
  for (const sym of [...alphabet, ...hatSymbols]) {
    graph.addEdge(lastScanId, scanToEndId, [rule(sym, sym, 'R')]);
    graph.addLoop(scanToEndId, sym, 'R');
  }

  // Sweep left
  let prev = scanToEndId;
  for (let step = 1; step <= numTapes + 1; step++) {
    const isLast = step === numTapes + 1;
    const curr   = isLast ? upIds[0] : keys.rewindDec(origStateId, readTuple, step); // readTuple added

    if (!isLast) graph.addNode(curr, `rewind\nt${numTapes + 1 - step}`);

    // DELIM transition from previous node into this one
    graph.addEdge(prev, curr, [rule(DELIM, DELIM, isLast ? 'R' : 'L')]);
    if (step === 1) graph.addEdge(lastScanId, curr, [rule(DELIM, DELIM, isLast ? 'R' : 'L')]);

    if (!isLast) {
      for (const sym of [...alphabet, ...hatSymbols]) graph.addLoop(curr, sym, 'L');
    }

    prev = curr;
  }
}

/**
 * Writes the new symbol and moves the virtual head for tape tapeIdx
 * For all but the last tape, after writing insert a crossToNext that scans right to the next DELIM and crosses it, so nextStateId always starts at the beginning of the next zone.
 * For the last tape, go directly to nextStateId.
 */
function buildUpdatePhase({
  origStateId, edgeId, tapeIdx, readTuple, readSym, writeVal, dir,
  nextStateId, isLastTape, numTapes, alphabet, hatSymbols, graph,
}) {
  const uid = keys.update(origStateId, edgeId, readTuple, tapeIdx);

  // Scan right within this zone to find the hat cell
  for (const sym of [...alphabet, DELIM]) {
    if (!sym.startsWith('^')) graph.addLoop(uid, sym, 'R');
  }

  let handoffId;
  if (isLastTape) {
    handoffId = nextStateId;
  } else {
    const crossId = keys.afterUpdate(origStateId, edgeId, readTuple, tapeIdx);
    graph.addNode(crossId, `crossToNext\nt${tapeIdx + 1}`);
    for (const sym of [...alphabet, ...hatSymbols]) graph.addLoop(crossId, sym, 'R');
    graph.addEdge(crossId, nextStateId, [rule(DELIM, DELIM, 'R')]);
    handoffId = crossId;
  }

  if (dir === 'N') {
    graph.addEdge(uid, handoffId, [rule('^' + readSym, '^' + writeVal, 'N')]);
  } else {
    const placeHatId = keys.placeHat(origStateId, edgeId, readTuple, tapeIdx);
    graph.addNode(placeHatId, `placeHat\nt${tapeIdx + 1}:${dir}`);

    graph.addEdge(uid, placeHatId, [rule('^' + readSym, writeVal, dir)]);

    for (const sym of alphabet) {
      graph.addEdge(placeHatId, handoffId, [rule(sym, '^' + sym, 'N')]);
    }

    const delimHit = dir === 'R' ? tapeIdx + 2 : tapeIdx + 1;
    buildShiftSubroutine({
      placeHatId, nextStateId: handoffId, tapeIdx, delimHit, dir,
      origStateId, edgeId, readTuple, numTapes, alphabet, hatSymbols, graph, 
    });
  }
}

// handles tape head hitting a DELIM, need to shift everything to the right to make room

function buildShiftSubroutine({
  placeHatId, nextStateId, tapeIdx, delimHit, dir,
  origStateId, edgeId, readTuple, numTapes, alphabet, hatSymbols, graph, 
}) {
  const ctx           = `${origStateId}__${edgeId}__${readTuple.join('')}__${tapeIdx}__d${delimHit}`; 
  const startDelimIdx = delimHit;
  const finalDelimIdx = numTapes + 1;
  const allTapeSyms   = [...alphabet, ...hatSymbols];

  const carryId  = (sym, d) => keys.shiftCarry(ctx, sym, d);
  const returnId = (d)       => keys.shiftReturn(ctx, d);
  const markId   =              keys.shiftMark(ctx);
  const finishId =              keys.shiftFinish(ctx);
  const doneId   =              keys.shiftDone(ctx);

  // Put a ☒ where we hit the DELIM 
  // If moving right, overwrite the DELIM and move into carry phase.
  // If moving left, skip the DELIM and put ☒ in the next cell.
  graph.addNode(markId, `shiftMark\nt${tapeIdx + 1}`);

  if (dir === 'R') {
    graph.addEdge(placeHatId, markId, [rule(DELIM, MARKER, 'R')]);

    if (startDelimIdx === finalDelimIdx) {
      // If it’s the last DELIM, just push it into a blank cell and start going left.
      graph.addNode(returnId(finalDelimIdx), `shiftReturn\nD${finalDelimIdx}`);
      graph.addEdge(markId, returnId(finalDelimIdx), [rule(BLANK, DELIM, 'L')]);
    } else {
      // Otherwise, start shifting all the symbols to the right.
      for (const sym of allTapeSyms) {
        graph.addEdge(markId, carryId(sym, startDelimIdx), [rule(sym, DELIM, 'R')]);
      }
      graph.addEdge(markId, carryId(DELIM, startDelimIdx + 1), [rule(DELIM, DELIM, 'R')]);
    }
  } else {
    // leave the DELIM, step right, mark the next cell, then start carry.
    const markLId = keys.shiftMarkL(ctx);
    graph.addNode(markLId, `shiftMarkL\nt${tapeIdx + 1}`);
    graph.addEdge(placeHatId, markLId, [rule(DELIM, DELIM, 'R')]);

    if (startDelimIdx === finalDelimIdx) {
      graph.addNode(returnId(finalDelimIdx), `shiftReturn\nD${finalDelimIdx}`);
      graph.addEdge(markLId, returnId(finalDelimIdx), [rule(BLANK, DELIM, 'L')]);
    } else {
      for (const sym of allTapeSyms) {
        graph.addEdge(markLId, carryId(sym, startDelimIdx), [rule(sym, MARKER, 'R')]);
      }
      graph.addEdge(markLId, carryId(DELIM, startDelimIdx + 1), [rule(BLANK, MARKER, 'R')]);
    }
  }

  // Move all symbols one cell to the right. DELIMs get carried along too.
  for (let d = startDelimIdx; d <= finalDelimIdx; d++) {
    const isFinal = d === finalDelimIdx;

    for (const carried of allTapeSyms) {
      const cId = carryId(carried, d);
      graph.addNode(cId, `carry:${carried}\nD${d}`);

      if (isFinal) {
        // write the symbol, push the DELIM one cell, then start sweeping back left.
        graph.addNode(finishId,    `shiftFinish\nt${tapeIdx + 1}`);
        graph.addNode(returnId(d), `shiftReturn\nD${d}`);
        graph.addEdge(cId,      finishId,    [rule(BLANK, carried, 'R')]);
        graph.addEdge(finishId, returnId(d), [rule(BLANK, DELIM,   'L')]);
      } else {
        // Shift tape symbols right in this zone
        for (const onTape of allTapeSyms) {
          graph.addEdge(cId, carryId(onTape, d), [rule(onTape, carried, 'R')]);
        }
        // Hit a DELIM: write carried symbol, carry '|' into next zone
        graph.addEdge(cId, carryId(DELIM, d + 1), [rule(DELIM, carried, 'R')]);
      }
    }
  }

  // Handle the DELIM being carried
  for (let d = startDelimIdx; d <= finalDelimIdx; d++) {
    const isFinal = d === finalDelimIdx;
    const cId     = carryId(DELIM, d);
    graph.addNode(cId, `carry:${DELIM}\nD${d}${isFinal ? '(final)' : ''}`);

    if (isFinal) {
      // last DELIM Write it into the blank and immediately go left
      graph.addNode(returnId(d), `shiftReturn\nD${d}`);
      graph.addEdge(cId, returnId(d), [rule(BLANK, DELIM, 'L')]);
    } else {
      for (const onTape of allTapeSyms) {
        graph.addEdge(cId, carryId(onTape, d), [rule(onTape, DELIM, 'R')]);
      }
      graph.addEdge(cId, carryId(DELIM, d + 1), [rule(DELIM, DELIM, 'R')]);
    }
  }

  // Sweep left through the zones until we hit  ☒
  for (let d = finalDelimIdx; d >= startDelimIdx; d--) {
    const rId = returnId(d);
    graph.addNode(rId, `shiftReturn\nD${d}`);

    for (const sym of allTapeSyms) graph.addLoop(rId, sym, 'L');

    if (d > startDelimIdx) {
      graph.addEdge(rId, returnId(d - 1), [rule(DELIM, DELIM, 'L')]);
    } else {
      graph.addLoop(rId, DELIM, 'L'); 
    }

    // Replace ☒ with a new head '^␣' and continue
    graph.addNode(doneId, `shiftDone\nt${tapeIdx + 1}`);
    graph.addEdge(rId, doneId, [rule(MARKER, '^' + BLANK, 'R')]);
  }

  // move the head over whatever symbol is under it now
  for (const sym of [...allTapeSyms, DELIM, MARKER]) {
    graph.addEdge(doneId, nextStateId, [rule(sym, sym, 'N')]);
  }
}

// scan R to reach the closing DELIM
// go  L crossing numTapes+1 DELIM back to the tape start.

function buildFinalRewind({
  rewindStartId, targetId, nextScanId,
  numTapes, alphabet, hatSymbols, graph,
}) {
  // scan right until we hit the last DELIM
  const rewindScanId = keys.rewindFinal(targetId, 'scan');
  graph.addNode(rewindScanId, `rewind\nscan→end`);
  for (const sym of [...alphabet, ...hatSymbols]) {
    graph.addEdge(rewindStartId, rewindScanId, [rule(sym, sym, 'R')]);
    graph.addLoop(rewindScanId, sym, 'R');
  }

  // go left crossing numTapes+1 DELIM back to the tape start.
  let curr = rewindScanId;
  for (let step = 1; step <= numTapes + 1; step++) {
    const isLast = step === numTapes + 1;
    const next   = isLast ? nextScanId : keys.rewindFinal(targetId, step);

    if (!isLast) graph.addNode(next, `rewind\nt${numTapes + 1 - step}`);

    if (step === 1) graph.addEdge(rewindStartId, next, [rule(DELIM, DELIM, isLast ? 'R' : 'L')]);
    graph.addEdge(curr, next, [rule(DELIM, DELIM, isLast ? 'R' : 'L')]);
    // Sweep left over all symbols in this zone
    for (const sym of [...alphabet, ...hatSymbols]) graph.addLoop(curr, sym, 'L');
    curr = next;
  }
}


// Main export
export function convertMultiToSingle(mtNodes, mtEdges) {

  const numTapes        = detectNumTapes(mtEdges);
  const origNodeMap     = buildNodeMap(mtNodes);
  const origTransitions = buildTransitionMap(mtNodes, mtEdges);
  const { alphabet, hatSymbols } = buildAlphabets(mtEdges, numTapes);

  const startOrig = mtNodes.find(n => n.type === 'start');

  if (!startOrig) {
    const emptyGraph = new GraphBuilder();
    emptyGraph.addNode('q_init', 'q_init', 'start');
    emptyGraph.applyLayout('q_init');
    return { nodes: emptyGraph.nodes, edges: emptyGraph.edges };
  }

  //Graph accumulator 
  const graph = new GraphBuilder();

  const INIT_ID = 'q_init';
  graph.addNode(INIT_ID, 'q_init', 'start');

  // cross the opening DELIM to begin scanning tape 1
  const firstScanId = keys.scan(startOrig.id, []);
  const startLabel  = origNodeMap[startOrig.id]?.data?.label || startOrig.id;
  graph.addNode(firstScanId, `scan\n${startLabel}\n[]`);
  graph.addEdge(INIT_ID, firstScanId, [rule(DELIM, DELIM, 'R')]);

  // BFS over (origState × scannedSoFar) pairs 
  const queue   = [{ origStateId: startOrig.id, scannedSoFar: [] }];
  const visited = new Set([`${startOrig.id}|`]);

  while (queue.length > 0) {
    const { origStateId, scannedSoFar } = queue.shift();
    const tapeZone = scannedSoFar.length;

    if (tapeZone < numTapes) {
      // scan virtual heads 
      buildScanPhase({
        origStateId, scannedSoFar, origNodeMap, origTransitions,
        numTapes, alphabet, hatSymbols, graph, queue, visited,
      });

    } else {
      // All heads scanned - find matching transition and rewind to tape 1 
      const readTuple = scannedSoFar;
      const lastScanId = keys.scan(origStateId, readTuple);
      const match = findMatchingTransition(origStateId, readTuple, origTransitions, numTapes);

      if (!match) continue; // no matching transition → reject

      const { edgeId, target, label } = match;

      // Extract writes and directions for all tapes
      const writes     = [];
      const directions = [];
      for (let t = 0; t < numTapes; t++) {
        const td = label[`tape${t + 1}`];
        writes.push(td?.write     || BLANK);
        directions.push(td?.direction || 'N');
      }

      // Create update-state nodes 
      const upIds = Array.from({ length: numTapes }, (_, t) => {
        const uid         = keys.update(origStateId, edgeId, readTuple, t); 
        const sourceLabel = origNodeMap[origStateId]?.data?.label || origStateId;
        graph.addNode(uid, `update\n${sourceLabel}\nt${t + 1}:${writes[t]},${directions[t]}`);
        return uid;
      });

      buildRewindToTape1({ lastScanId, origStateId, readTuple, upIds, numTapes, alphabet, hatSymbols, graph });

      const rewindId    = keys.rewindFinal(target, 0);
      const targetLabel = origNodeMap[target]?.data?.label || target;
      const targetType  = acceptOrigIds.has(target) ? 'accept' : 'normal';
      graph.addNode(rewindId, `rewind\n→${targetLabel}`, targetType);

      // Build the update step for each tape in sequence.
      // crossToNext bridge is added after each non-final tape's update so the
      // next update state always starts at the beginning of its tape zone.
      for (let t = 0; t < numTapes; t++) {
        const isLastTape  = t === numTapes - 1;
        const nextStateId = isLastTape ? rewindId : upIds[t + 1];
        buildUpdatePhase({
          origStateId, edgeId, tapeIdx: t,
          readTuple, readSym: readTuple[t], writeVal: writes[t], dir: directions[t],
          nextStateId, isLastTape, numTapes, alphabet, hatSymbols, graph,
        });
      }

      if (!acceptOrigIds.has(target)) {
        // Rewind back to the start of tape 1 for the next scan phase
        const nextScanId = keys.scan(target, []);
        graph.addNode(nextScanId, `scan\n${targetLabel}\n[]`);
        buildFinalRewind({
          rewindStartId: rewindId, targetId: target, nextScanId,
          numTapes, alphabet, hatSymbols, graph,
        });

        // Enqueue the target state if not yet visited
        const vKey = `${target}|`;
        if (!visited.has(vKey)) {
          visited.add(vKey);
          queue.push({ origStateId: target, scannedSoFar: [] });
        }
      }
    }
  }


  graph.mergeParallelEdges();

  // Prune unreachable nodes forward BFS from INIT_ID, keep only reachable nodes and edges whose source is reachable.
  const reachable = new Set();
  const bfsQueue  = [INIT_ID];
  reachable.add(INIT_ID);
  const adjFwd = {};
  for (const e of graph.edges) {
    (adjFwd[e.source] ||= []).push(e.target);
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
  graph.edges = graph.edges.filter(e =>
    reachable.has(e.source) &&
    reachable.has(e.target) &&
    graph.nodes.find(n => n.id === e.source)?.type !== 'accept' 
  );

  graph.applyLayout(INIT_ID);

  return { nodes: graph.nodes, edges: graph.edges };
}