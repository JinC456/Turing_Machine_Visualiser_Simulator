/**
 * src/simulatorComponents/engines/convertMultiToSingle.js
 *
 * Converts a multi-tape Turing machine into an equivalent single-tape TM
 * using the standard track-interleaving simulation. Each original tape is
 * represented as a section of the single tape separated by '|' delimiters,
 * and the head position on each tape is marked with a '^' prefix on the
 * symbol under the head (e.g. '^a' means the head is on cell containing 'a').
 *
 * Single-tape layout for k tapes:
 * | [tape 1 contents] | [tape 2 contents] | ... | [tape k contents] |
 *
 * The simulation proceeds in three phases per step:
 * 1. SCAN   — sweep right, recording the symbol under each virtual head
 * 2. DECIDE — look up the matching transition for the read tuple
 * 3. UPDATE — sweep through each tape section, writing and moving heads
 *
 * When a head moves right into a '|' delimiter, we must right-shift all
 * subsequent tape content to make room for the new head cell. This is done
 * by a dedicated SHIFT subroutine that carries each symbol one cell to the
 * right and uses a '☒' marker to remember the insertion point.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BLANK  = '␣';
const DELIM  = '|';
const MARKER = '☒'; // insertion-point marker; not on standard keyboards

// ---------------------------------------------------------------------------
// Node / edge factories
// ---------------------------------------------------------------------------

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

/** A single transition rule {read, write, direction}. */
function rule(read, write, direction) {
  return { read, write, direction };
}

// ---------------------------------------------------------------------------
// State-ID key builders  (centralised so naming is consistent throughout)
// ---------------------------------------------------------------------------

const keys = {
  scan:        (stateId, scanned)             => `scan__${stateId}__${scanned.join(',')}`,
  rewindDec:   (stateId, tuple, step)         => `rwdDec__${stateId}__${tuple.join('')}__${step}`,
  update:      (stateId, edgeId, tuple, tIdx) => `update__${stateId}__${edgeId}__${tuple.join('')}__${tIdx}`,
  placeHat:    (stateId, edgeId, tuple, tIdx) => `placeHat__${stateId}__${edgeId}__${tuple.join('')}__${tIdx}`,
  afterUpdate: (stateId, edgeId, tuple, tIdx) => `afterUpdate__${stateId}__${edgeId}__${tuple.join('')}__${tIdx}`,
  rewindFinal: (targetId, step)               => `rewind__${targetId}__${step}`,

  // Right-shift subroutine states
  shiftMark:   (ctx)                      => `shiftMark__${ctx}`,
  shiftMarkL:  (ctx)                      => `shiftMarkL__${ctx}`,
  shiftCarry:  (ctx, sym, delimZone)      => `shiftCarry_${sym}_D${delimZone}__${ctx}`,
  shiftFinish: (ctx)                      => `shiftFinish__${ctx}`,
  shiftReturn: (ctx, delimZone)           => `shiftReturn_D${delimZone}__${ctx}`,
  shiftDone:   (ctx)                      => `shiftDone__${ctx}`,
};

// ---------------------------------------------------------------------------
// Input extraction helpers
// ---------------------------------------------------------------------------

/** Returns the highest tape index referenced across all edge labels. */
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

/** Builds a map from node id → node object. */
function buildNodeMap(mtNodes) {
  return Object.fromEntries(mtNodes.map(n => [n.id, n]));
}

/**
 * Builds a map from source-state id → list of {edgeId, target, label}
 * for every individual label object on every edge.
 */
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

/**
 * Collects every plain symbol (including BLANK) that appears as a read or
 * write value across all tapes, then derives the hat-prefixed set from it.
 */
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

// ---------------------------------------------------------------------------
// Graph builder  (accumulates nodes + edges, deduplicates, then lays out)
// ---------------------------------------------------------------------------

class GraphBuilder {
  constructor() {
    this.nodes    = [];
    this.edges    = [];
    this._created = new Set();
  }

  /** Adds a node only if its id hasn't been seen before. */
  addNode(id, label, type = 'normal') {
    if (!this._created.has(id)) {
      this.nodes.push(makeNode(id, label, type));
      this._created.add(id);
    }
  }

  addEdge(source, target, labels) {
    this.edges.push(makeEdge(source, target, labels));
  }

  /** Adds a self-loop (symbol passes through unchanged). */
  addLoop(stateId, sym, dir = 'R') {
    this.addEdge(stateId, stateId, [rule(sym, sym, dir)]);
  }

  /**
   * Merges parallel edges sharing the same source→target into one edge whose
   * labels array is the deduplicated union of all individual label objects.
   */
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

  /**
   * Assigns (x, y) positions via a BFS level layout rooted at rootId.
   * Nodes unreachable from the root are placed at level 0.
   */
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

// ---------------------------------------------------------------------------
// Phase builders
// ---------------------------------------------------------------------------

/**
 * SCAN PHASE
 * Sweeps right across the single tape. When it encounters a hat symbol '^x'
 * in the section for tape (tapeZone+1), it records 'x' in scannedSoFar and
 * transitions to a new scan state with that recording appended.
 * All other symbols (plain alphabet, delimiters, irrelevant hats) are skipped.
 */
function buildScanPhase({
  origStateId, scannedSoFar, origNodeMap, origTransitions,
  numTapes, alphabet, hatSymbols, graph, queue, visited,
}) {
  const tapeZone   = scannedSoFar.length;
  const currScanId = keys.scan(origStateId, scannedSoFar);
  const stateLabel = origNodeMap[origStateId]?.data?.label || origStateId;

  // Only branch on hat symbols whose underlying value is actually read on this tape
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

/**
 * Finds the first transition out of origStateId whose per-tape read values
 * all match the given readTuple. Called at code-generation time — no runtime
 * decision state is needed since the match is baked into the generated graph.
 */
function findMatchingTransition(origStateId, readTuple, origTransitions, numTapes) {
  return (origTransitions[origStateId] || []).find(({ label }) =>
    Array.from({ length: numTapes }, (_, i) => {
      const td  = label[`tape${i + 1}`];
      const got = readTuple[i] ?? BLANK;
      return td && (td.read === got || (td.read === BLANK && got === BLANK));
    }).every(Boolean)
  );
}

/**
 * REWIND TO TAPE 1
 * Once all heads are scanned, sweeps leftward from the final scan state back
 * to the start of tape 1 so the UPDATE phase can begin scanning for hat symbols.
 *
 * Produces a chain:  lastScanId → rwdDec_1 → rwdDec_2 → ... → upIds[0]
 */
function buildRewindToTape1({
  lastScanId, origStateId, readTuple, upIds,
  numTapes, alphabet, hatSymbols, graph,
}) {
  // scanToEnd sweeps R to the closing DELIM — R rules only, never L.
  // lastScanId is a scan state so it also must never get L rules.
  const scanToEndId = keys.rewindDec(origStateId, readTuple, 'scanToEnd'); // readTuple added
  graph.addNode(scanToEndId, `scanToEnd\nt${numTapes}`);
  for (const sym of [...alphabet, ...hatSymbols]) {
    graph.addEdge(lastScanId, scanToEndId, [rule(sym, sym, 'R')]);
    graph.addLoop(scanToEndId, sym, 'R');
  }

  // Sweep left — rewindDec nodes get L rules only.
  // scanToEnd is R-only so it just feeds into the first rewind node via DELIM.
  // lastScanId feeds in too if it lands directly on the closing DELIM.
  let prev = scanToEndId;
  for (let step = 1; step <= numTapes + 1; step++) {
    const isLast = step === numTapes + 1;
    const curr   = isLast ? upIds[0] : keys.rewindDec(origStateId, readTuple, step); // readTuple added

    if (!isLast) graph.addNode(curr, `rewind\nt${numTapes + 1 - step}`);

    // DELIM transition from previous node into this one
    graph.addEdge(prev, curr, [rule(DELIM, DELIM, isLast ? 'R' : 'L')]);
    if (step === 1) graph.addEdge(lastScanId, curr, [rule(DELIM, DELIM, isLast ? 'R' : 'L')]);

    // L-loops only on rewindDec nodes (curr), never on scanToEnd or lastScanId
    if (!isLast) {
      for (const sym of [...alphabet, ...hatSymbols]) graph.addLoop(curr, sym, 'L');
    }

    prev = curr;
  }
}

/**
 * UPDATE PHASE — single tape
 * Writes the new symbol and moves the virtual head for tape tapeIdx.
 *
 * For all but the last tape, after writing we insert a crossToNext bridge
 * that scans right to the next DELIM and crosses it, so nextStateId always
 * starts cleanly at the beginning of the next tape zone.
 * For the last tape, we hand off directly to nextStateId (the rewind state).
 *
 * dir = 'N': rewrite ^old → ^writeVal, N → crossToNext → nextStateId
 * dir = 'L'/'R': strip ^, step, placeHat on neighbour → crossToNext → nextStateId
 * - neighbour is DELIM → SHIFT subroutine → crossToNext → nextStateId
 */
function buildUpdatePhase({
  origStateId, edgeId, tapeIdx, readTuple, readSym, writeVal, dir,
  nextStateId, isLastTape, numTapes, alphabet, hatSymbols, graph,
}) {
  const uid = keys.update(origStateId, edgeId, readTuple, tapeIdx);

  // Scan right within this tape zone to find the hat cell
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
      origStateId, edgeId, readTuple, numTapes, alphabet, hatSymbols, graph, // readTuple added
    });
  }
}

/**
 * SHIFT SUBROUTINE
 * Triggered when the virtual head for tape tapeIdx tries to move into a DELIM.
 *
 * We need to insert a new '^␣' cell at the DELIM boundary, which requires
 * shifting every symbol to the right by one cell across all subsequent zones.
 *
 * Zones are numbered 1..numTapes+1 (numTapes+1 = the final closing DELIM).
 * startDelimIdx = tapeIdx+2 is the delimiter to the right of tape tapeIdx (0-based).
 *
 * Algorithm:
 * 1. shiftMark   — write ☒ over the DELIM (marks insertion point), move R
 * 2. shiftCarry  — carry each symbol one step right; when a DELIM is hit,
 * write the carried symbol and carry '|' into the next zone;
   * in the final zone write carried into blank, then write DELIM one cell right,
   * stepping L twice back into the tape content
 * 3. shiftReturn — sweep left back through each zone to find ☒
 * 4. shiftDone   — replace ☒ with '^␣', hand off to nextStateId
 */
function buildShiftSubroutine({
  placeHatId, nextStateId, tapeIdx, delimHit, dir,
  origStateId, edgeId, readTuple, numTapes, alphabet, hatSymbols, graph, // readTuple added to params
}) {
  // delimHit is the 1-based index of the delimiter placeHat just landed on.
  // We scope state ids by both tapeIdx and delimHit so that L and R moves on
  // the same tape don't share (and conflict on) shift subroutine states.
  const ctx           = `${origStateId}__${edgeId}__${readTuple.join('')}__${tapeIdx}__d${delimHit}`; // now uses readTuple safely
  const startDelimIdx = delimHit;
  const finalDelimIdx = numTapes + 1;
  const allTapeSyms   = [...alphabet, ...hatSymbols];

  // Convenience id builders scoped to this subroutine instance
  const carryId  = (sym, d) => keys.shiftCarry(ctx, sym, d);
  const returnId = (d)       => keys.shiftReturn(ctx, d);
  const markId   =              keys.shiftMark(ctx);
  const finishId =              keys.shiftFinish(ctx);
  const doneId   =              keys.shiftDone(ctx);

  // ── 1. shiftMark ──────────────────────────────────────────────────────────
  // dir = R: head moved right into DELIM — overwrite it with ☒, move R.
  //   The carry phase restores the DELIM by writing it as the first carried value.
  //
  // dir = L: head moved left into DELIM — keep the DELIM in place, move R,
  //   write ☒ in the next cell, move R again into the carry phase.
  //   An intermediate shiftMarkL state handles the extra step.
  graph.addNode(markId, `shiftMark\nt${tapeIdx + 1}`);

  if (dir === 'R') {
    // Overwrite DELIM with ☒, land on first cell of next zone.
    // The carry phase restores the DELIM by writing it as the first carried value.
    graph.addEdge(placeHatId, markId, [rule(DELIM, MARKER, 'R')]);

    if (startDelimIdx === finalDelimIdx) {
      // At the final delimiter — cell to the right is blank.
      // Write DELIM there (push final delimiter one cell right) and go left.
      graph.addNode(returnId(finalDelimIdx), `shiftReturn\nD${finalDelimIdx}`);
      graph.addEdge(markId, returnId(finalDelimIdx), [rule(BLANK, DELIM, 'L')]);
    } else {
      // ☒ replaced the DELIM so write DELIM as the first carried value.
      for (const sym of allTapeSyms) {
        graph.addEdge(markId, carryId(sym, startDelimIdx), [rule(sym, DELIM, 'R')]);
      }
      graph.addEdge(markId, carryId(DELIM, startDelimIdx + 1), [rule(DELIM, DELIM, 'R')]);
    }
  } else {
    // Keep DELIM in place, step R, write ☒ over next cell, step R into carry.
    // The | was NOT destroyed so there is nothing to restore — go directly to
    // carry states WITHOUT writing | first.
    const markLId = keys.shiftMarkL(ctx);
    graph.addNode(markLId, `shiftMarkL\nt${tapeIdx + 1}`);
    graph.addEdge(placeHatId, markLId, [rule(DELIM, DELIM, 'R')]);

    if (startDelimIdx === finalDelimIdx) {
      // Already at the final delimiter zone — just write DELIM and go left.
      graph.addNode(returnId(finalDelimIdx), `shiftReturn\nD${finalDelimIdx}`);
      graph.addEdge(markLId, returnId(finalDelimIdx), [rule(BLANK, DELIM, 'L')]);
    } else {
      // Write ☒ over whatever is here, then go directly into the carry states
      // (no | to restore — the | was kept in place by placeHat).
      for (const sym of allTapeSyms) {
        graph.addEdge(markLId, carryId(sym, startDelimIdx), [rule(sym, MARKER, 'R')]);
      }
      graph.addEdge(markLId, carryId(DELIM, startDelimIdx + 1), [rule(BLANK, MARKER, 'R')]);
    }
  }

  // ── 2. shiftCarry ─────────────────────────────────────────────────────────
  // Build carry states for tape-symbol carriers across each delimiter zone.
  for (let d = startDelimIdx; d <= finalDelimIdx; d++) {
    const isFinal = d === finalDelimIdx;

    for (const carried of allTapeSyms) {
      const cId = carryId(carried, d);
      graph.addNode(cId, `carry:${carried}\nD${d}`);

      if (isFinal) {
        // Write the carried symbol into the first blank beyond the tape, then
        // write a new DELIM one cell further right, then start sweeping left.
        graph.addNode(finishId,    `shiftFinish\nt${tapeIdx + 1}`);
        graph.addNode(returnId(d), `shiftReturn\nD${d}`);
        graph.addEdge(cId,      finishId,    [rule(BLANK, carried, 'R')]);
        graph.addEdge(finishId, returnId(d), [rule(BLANK, DELIM,   'L')]);
      } else {
        // Shift tape symbols right within this zone
        for (const onTape of allTapeSyms) {
          graph.addEdge(cId, carryId(onTape, d), [rule(onTape, carried, 'R')]);
        }
        // Hit a DELIM: write carried symbol, carry '|' into next zone
        graph.addEdge(cId, carryId(DELIM, d + 1), [rule(DELIM, carried, 'R')]);
      }
    }
  }

  // DELIM itself can also be the carried symbol ('|' is not in allTapeSyms)
  for (let d = startDelimIdx; d <= finalDelimIdx; d++) {
    const isFinal = d === finalDelimIdx;
    const cId     = carryId(DELIM, d);
    graph.addNode(cId, `carry:${DELIM}\nD${d}${isFinal ? '(final)' : ''}`);

    if (isFinal) {
      // The carried DELIM is the final delimiter being pushed one cell right.
      // Write it into the blank and immediately go left — no need for a second DELIM.
      graph.addNode(returnId(d), `shiftReturn\nD${d}`);
      graph.addEdge(cId, returnId(d), [rule(BLANK, DELIM, 'L')]);
    } else {
      for (const onTape of allTapeSyms) {
        graph.addEdge(cId, carryId(onTape, d), [rule(onTape, DELIM, 'R')]);
      }
      graph.addEdge(cId, carryId(DELIM, d + 1), [rule(DELIM, DELIM, 'R')]);
    }
  }

  // ── 3. shiftReturn ────────────────────────────────────────────────────────
  // Sweep left back through each zone. Cross DELIMs leftward until ☒ is found.
  for (let d = finalDelimIdx; d >= startDelimIdx; d--) {
    const rId = returnId(d);
    graph.addNode(rId, `shiftReturn\nD${d}`);

    for (const sym of allTapeSyms) graph.addLoop(rId, sym, 'L');

    if (d > startDelimIdx) {
      graph.addEdge(rId, returnId(d - 1), [rule(DELIM, DELIM, 'L')]);
    } else {
      graph.addLoop(rId, DELIM, 'L'); // already at start zone, shouldn't hit | before ☒
    }

    // ── 4. shiftDone ─────────────────────────────────────────────────────────
    // Found ☒ — write '^␣' (new head cell) and hand off to nextStateId.
    graph.addNode(doneId, `shiftDone\nt${tapeIdx + 1}`);
    graph.addEdge(rId, doneId, [rule(MARKER, '^' + BLANK, 'R')]);
  }

  // Pass through whichever symbol is now under the head (no-op move)
  for (const sym of [...allTapeSyms, DELIM, MARKER]) {
    graph.addEdge(doneId, nextStateId, [rule(sym, sym, 'N')]);
  }
}

/**
 * FINAL REWIND
 * After all tape updates are done, sweeps left back to the start of tape 1
 * so the next SCAN phase begins from the first DELIM.
 *
 * The head can be anywhere on the tape after the last update, so we first
 * scan RIGHT past all remaining content to reach the closing DELIM, then
 * sweep LEFT crossing all numTapes+1 delimiters back to the tape start.
 *
 * Produces a chain:  rewindStartId →(scan R)→ rewindScanId →(sweep L)→ ... → nextScanId
 */
function buildFinalRewind({
  rewindStartId, targetId, nextScanId,
  numTapes, alphabet, hatSymbols, graph,
}) {
  // Phase 1: if not already on a DELIM, scan right until we find one.
  // If rewindStartId is already on a DELIM it goes straight into the leftward
  // sweep; otherwise it enters rewindScanId and loops right until it hits DELIM.
  const rewindScanId = keys.rewindFinal(targetId, 'scan');
  graph.addNode(rewindScanId, `rewind\nscan→end`);
  for (const sym of [...alphabet, ...hatSymbols]) {
    graph.addEdge(rewindStartId, rewindScanId, [rule(sym, sym, 'R')]);
    graph.addLoop(rewindScanId, sym, 'R');
  }

  // Phase 2: sweep left crossing numTapes+1 delimiters back to the tape start.
  // Both rewindStartId (landed on DELIM) and rewindScanId (scanned to DELIM)
  // feed directly into the first leftward-sweep node.
  let curr = rewindScanId;
  for (let step = 1; step <= numTapes + 1; step++) {
    const isLast = step === numTapes + 1;
    const next   = isLast ? nextScanId : keys.rewindFinal(targetId, step);

    if (!isLast) graph.addNode(next, `rewind\nt${numTapes + 1 - step}`);

    // Both entry points feed into the first step
    if (step === 1) graph.addEdge(rewindStartId, next, [rule(DELIM, DELIM, isLast ? 'R' : 'L')]);
    graph.addEdge(curr, next, [rule(DELIM, DELIM, isLast ? 'R' : 'L')]);
    for (const sym of [...alphabet, ...hatSymbols]) graph.addLoop(curr, sym, 'L');
    curr = next;
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function convertMultiToSingle(mtNodes, mtEdges) {

  // ── Input analysis ────────────────────────────────────────────────────────
  const numTapes        = detectNumTapes(mtEdges);
  const origNodeMap     = buildNodeMap(mtNodes);
  const origTransitions = buildTransitionMap(mtNodes, mtEdges);
  const { alphabet, hatSymbols } = buildAlphabets(mtEdges, numTapes);

  const startOrig = mtNodes.find(n => n.type === 'start');
  if (!startOrig) return { nodes: [], edges: [] };
  const acceptOrigIds = new Set(mtNodes.filter(n => n.type === 'accept').map(n => n.id));

  // ── Graph accumulator ─────────────────────────────────────────────────────
  const graph = new GraphBuilder();

  const INIT_ID = 'q_init';
  graph.addNode(INIT_ID, 'q_init', 'start');

  // Bootstrap: cross the opening DELIM to begin scanning tape 1
  const firstScanId = keys.scan(startOrig.id, []);
  const startLabel  = origNodeMap[startOrig.id]?.data?.label || startOrig.id;
  graph.addNode(firstScanId, `scan\n${startLabel}\n[]`);
  graph.addEdge(INIT_ID, firstScanId, [rule(DELIM, DELIM, 'R')]);

  // ── BFS over (origState × scannedSoFar) pairs ─────────────────────────────
  const queue   = [{ origStateId: startOrig.id, scannedSoFar: [] }];
  const visited = new Set([`${startOrig.id}|`]);

  while (queue.length > 0) {
    const { origStateId, scannedSoFar } = queue.shift();
    const tapeZone = scannedSoFar.length;

    if (tapeZone < numTapes) {
      // ── Still scanning virtual heads ──────────────────────────────────────
      buildScanPhase({
        origStateId, scannedSoFar, origNodeMap, origTransitions,
        numTapes, alphabet, hatSymbols, graph, queue, visited,
      });

    } else {
      // ── All heads scanned — find matching transition and rewind to tape 1 ───
      const readTuple = scannedSoFar;
      const lastScanId = keys.scan(origStateId, readTuple);
      const match = findMatchingTransition(origStateId, readTuple, origTransitions, numTapes);

      if (!match) continue; // no matching transition → implicit reject

      const { edgeId, target, label } = match;

      // Extract writes and directions for all tapes
      const writes     = [];
      const directions = [];
      for (let t = 0; t < numTapes; t++) {
        const td = label[`tape${t + 1}`];
        writes.push(td?.write     || BLANK);
        directions.push(td?.direction || 'N');
      }

      // Create update-state nodes upfront (needed as targets for rewind)
      const upIds = Array.from({ length: numTapes }, (_, t) => {
        const uid         = keys.update(origStateId, edgeId, readTuple, t); // Added readTuple
        const sourceLabel = origNodeMap[origStateId]?.data?.label || origStateId;
        graph.addNode(uid, `update\n${sourceLabel}\nt${t + 1}:${writes[t]},${directions[t]}`);
        return uid;
      });

      // The last scan state has finished collecting all head symbols and is
      // sitting just before the closing DELIM — no R-loops needed.
      // buildRewindToTape1 owns lastScanId entirely and gives it only L-rules.
      buildRewindToTape1({ lastScanId, origStateId, readTuple, upIds, numTapes, alphabet, hatSymbols, graph });

      // The rewind-to-next-scan state anchors the final rewind chain
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
      // If target is an accept state, rewindId is already typed 'accept' — it's the terminal.
    }
  }

  // ── Post-processing ───────────────────────────────────────────────────────
  graph.mergeParallelEdges();

  // Prune unreachable nodes: forward BFS from INIT_ID, keep only reachable nodes
  // and edges whose source is reachable. This eliminates dead states (e.g. shiftMark
  // nodes generated for a direction that is never actually used, or nodes only
  // reachable from accept states which should have no outgoing transitions).
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
    graph.nodes.find(n => n.id === e.source)?.type !== 'accept' // accept is terminal
  );

  graph.applyLayout(INIT_ID);

  return { nodes: graph.nodes, edges: graph.edges };
}