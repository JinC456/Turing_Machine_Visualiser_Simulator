/* src/Visualiser.jsx */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ReactFlowProvider, useNodesState, useEdgesState } from 'reactflow';
import { getNodeLabel } from './simulatorComponents/engines/Deterministic';

import TapeContainer from './simulatorComponents/TapeContainer';
import DiagramContainer from './visualComponents/DiagramContainer';
import TransitionTable from './simulatorComponents/TransitionTable';
import './Visualiser.css';

import palindromeData from './examples/palindrome.json'; 
import binaryIncrementData from './examples/binary_increment.json';
import flipData from './examples/flip.json'; 
import busyBeaverData from './examples/busy_beaver.json';

import palindromeMultiData from './examples/palindrome_multi.json';
import isEqualMultiData from './examples/is_equal_multi.json';
import copyData from './examples/copy.json'; 
import binaryAdditionData from './examples/binary_addition.json';

import isEqualNTMData from './examples/Is_equal_NTM.json';
import FindHashData from './examples/Find_hash.json';

const exampleMap = {
  // Deterministic
  palindrome: palindromeData,
  binary_increment: binaryIncrementData,
  flip : flipData,
  busy_beaver: busyBeaverData,
  
  // Multi-Tape
  palindrome_multi: palindromeMultiData,
  is_equal_multi: isEqualMultiData, 
  copy: copyData,
  binary_addition: binaryAdditionData,


  // Non-Deterministic
  is_equal_NTM: isEqualNTMData, 
  Find_hash: FindHashData
};

export default function Visualiser({ engine, selectedExample, showTable, setShowTable }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [activeNodeId, setActiveNodeId] = useState(null);
  const [activeEdgeId, setActiveEdgeId] = useState(null);
  const [currentSymbol, setCurrentSymbol] = useState("");
  const [stepCount, setStepCount] = useState(0);

  const [loadedInput, setLoadedInput] = useState("");
  const [manualSymbols, setManualSymbols] = useState([]);
  const [note, setNote] = useState("");

  // --- LIFTED STATE: Simulation Running Status ---
  const [isRunning, setIsRunning] = useState(false);

  // --- UNIFIED HISTORY ---
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const historyCounter = useRef(0);

  // Snapshot nodes+edges+manualSymbols. snapshotOverride lets callers pass
  // a pre-mutation snapshot (e.g. before a drag begins).
  const pushToHistory = useCallback((label = "Unknown Action", snapshotOverride = null) => {
    historyCounter.current += 1;
    const actionId = historyCounter.current;

    const snap = snapshotOverride ?? { nodes, edges, manualSymbols };

    const clonedNodes = snap.nodes.map(n => ({ ...n, data: { ...n.data } }));
    const clonedEdges = snap.edges.map(e => ({
      ...e,
      data: { ...e.data, labels: JSON.parse(JSON.stringify(e.data.labels || [])) },
    }));
    const clonedSymbols = [...(snap.manualSymbols ?? manualSymbols)];

    setHistory(h => [...h, { nodes: clonedNodes, edges: clonedEdges, manualSymbols: clonedSymbols, metadata: { id: actionId, label } }].slice(-50));
    setFuture([]);
  }, [nodes, edges, manualSymbols]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;

    const previous = history[history.length - 1];
    const currentSnapshot = {
      nodes: nodes.map(n => ({ ...n, data: { ...n.data } })),
      edges: edges.map(e => ({ ...e, data: { ...e.data, labels: JSON.parse(JSON.stringify(e.data.labels || [])) } })),
      manualSymbols: [...manualSymbols],
    };

    setHistory(h => h.slice(0, -1));
    setFuture(f => [...f, { ...currentSnapshot, metadata: previous.metadata }]);

    setNodes(previous.nodes);
    setEdges(previous.edges);
    setManualSymbols(previous.manualSymbols ?? []);
  }, [history, nodes, edges, manualSymbols, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;

    const next = future[future.length - 1];
    const currentSnapshot = {
      nodes: nodes.map(n => ({ ...n, data: { ...n.data } })),
      edges: edges.map(e => ({ ...e, data: { ...e.data, labels: JSON.parse(JSON.stringify(e.data.labels || [])) } })),
      manualSymbols: [...manualSymbols],
    };

    setFuture(f => f.slice(0, -1));
    setHistory(h => [...h, { ...currentSnapshot, metadata: next.metadata }]);

    setNodes(next.nodes);
    setEdges(next.edges);
    setManualSymbols(next.manualSymbols ?? []);
  }, [future, nodes, edges, manualSymbols, setNodes, setEdges]);

  // Reset history when engine changes or example loads (handled below)

  // Global: space key → ␣ in any input/textarea on the site
  useEffect(() => {
    const handleGlobalSpace = (e) => {
      const el = e.target;
      if ((el.tagName === "INPUT" && el.type === "text") || el.tagName === "TEXTAREA") {
        if (e.key === " " || e.code === "Space") {
          e.preventDefault();
          const start = el.selectionStart;
          const end = el.selectionEnd;
          const blank = "␣";
          const newVal = el.value.slice(0, start) + blank + el.value.slice(end);
          // Use native input setter so React's onChange fires
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set
            || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
          nativeInputValueSetter?.call(el, newVal);
          el.dispatchEvent(new Event("input", { bubbles: true }));
          // Restore cursor after the inserted character
          requestAnimationFrame(() => el.setSelectionRange(start + blank.length, start + blank.length));
        }
      }
    };
    document.addEventListener("keydown", handleGlobalSpace, true);
    return () => document.removeEventListener("keydown", handleGlobalSpace, true);
  }, []);

  // Clear workspace/tape when engine changes
  useEffect(() => {
    setNodes([]);
    setEdges([]);
    setLoadedInput(""); 
    setManualSymbols([]);
    setStepCount(0);
    setCurrentSymbol("");
    setActiveNodeId(null);
    setActiveEdgeId(null);
    setNote("");
    setIsRunning(false); // Ensure simulation stops on engine switch
    setHistory([]);
    setFuture([]);
  }, [engine, setNodes, setEdges]);

  useEffect(() => {
    if (selectedExample && exampleMap[selectedExample]) {
      const { nodes: newNodes, edges: newEdges, defaultInput, note: exampleNote } = exampleMap[selectedExample];
      setNodes(newNodes);
      setEdges(newEdges);
      setLoadedInput(defaultInput || "");
      setNote(exampleNote || "");
      setActiveNodeId(null);
      setActiveEdgeId(null);
      setStepCount(0);
      setCurrentSymbol("");
      setManualSymbols([]); 
      setIsRunning(false); // Ensure simulation stops on example load
      setHistory([]);
      setFuture([]);
    }
  }, [selectedExample, setNodes, setEdges]);

  const handleClear = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setLoadedInput("");
    setManualSymbols([]);
    setStepCount(0);
    setCurrentSymbol("");
    setActiveNodeId(null);
    setActiveEdgeId(null);
    setNote("");
    setIsRunning(false);
    setHistory([]);
    setFuture([]);
  }, [setNodes, setEdges]);

  // Calculate Valid Alphabet
  const validAlphabet = useMemo(() => {
    const derived = new Set();
    edges.forEach(edge => {
        edge.data?.labels?.forEach(l => {
            if (l.read !== undefined && l.read !== "") derived.add(l.read);
            if (l.write !== undefined && l.write !== "") derived.add(l.write);
            
            Object.keys(l).forEach(key => {
                if (key.startsWith('tape')) {
                    const t = l[key];
                    if (t.read) derived.add(t.read);
                    if (t.write) derived.add(t.write);
                }
            });
        });
    });
    return new Set([...derived, ...manualSymbols]);
  }, [edges, manualSymbols]);

  const handleSymbolScrub = useCallback((targetChar) => {
  pushToHistory(`Deleted Symbol: ${targetChar}`);
  setManualSymbols(prev => prev.filter(s => s !== targetChar));

  setEdges(prev => prev.map(edge => ({
    ...edge,
    data: {
      ...edge.data,
      labels: (edge.data.labels || []).filter(l => {
        if (engine === "MultiTape") {
          return !Object.keys(l).some(k => {
            if (k.startsWith('tape')) {
              return l[k].read === targetChar || l[k].write === targetChar;
            }
            return false;
          });
        }
        return l.read !== targetChar && l.write !== targetChar;
      })
    }
  })).filter(edge => edge.data.labels && edge.data.labels.length > 0)); 

  setActiveEdgeId(null);
  setCurrentSymbol("");
}, [engine, setEdges, setManualSymbols, setActiveEdgeId, setCurrentSymbol, pushToHistory]);

  const handleAddState = useCallback((label) => {
    pushToHistory(`Added State: ${label}`);
    const id = `state-${Date.now()}`;
    // Place new nodes in a staggered position so they don't stack
    const offset = nodes.length * 20;
    const newNode = {
      id,
      type: 'normal',
      position: { x: 200 + offset, y: 200 + offset },
      data: { label },
    };
    setNodes(prev => [...prev, newNode]);
  }, [nodes.length, setNodes, pushToHistory]);

  const handleSymbolReplace = useCallback((oldChar, newChar) => {
    pushToHistory(`Replaced Symbol: ${oldChar} → ${newChar}`);
    setEdges(prev => prev.map(edge => ({
      ...edge,
      data: {
        ...edge.data,
        labels: edge.data.labels.map(l => {
          const newL = { ...l };
          if (engine === "MultiTape") {
            Object.keys(newL).forEach(k => {
              if (k.startsWith('tape')) {
                if (newL[k].read === oldChar) newL[k].read = newChar;
                if (newL[k].write === oldChar) newL[k].write = newChar;
              }
            });
          } else {
            if (newL.read === oldChar) newL.read = newChar;
            if (newL.write === oldChar) newL.write = newChar;
          }
          return newL;
        })
      }
    })));
  }, [engine, setEdges, pushToHistory]);

  const handleDeleteNode = useCallback((nodeId) => {
    pushToHistory("Deleted State");
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId));
    setActiveNodeId(prev => prev === nodeId ? null : prev);
  }, [setNodes, setEdges, setActiveNodeId, pushToHistory]);

  // Called by TransitionTable when user edits a cell inline
  const handleEditRule = useCallback(({ type, nodeId, symbol, rules, ruleIdx, field, value, allRules, tuple }) => {
    pushToHistory("Rule Edited");
    if (type === "matrix") {
      // rules is an array of { write, direction, nextStateLabel } (NTM may have multiple)
      // First, ensure all target nodes exist and collect their ids
      const resolvedRules = [];
      const newNodes = [];
      for (const rule of rules) {
        let targetNode = nodes.find(n => getNodeLabel(n) === rule.nextStateLabel);
        if (!targetNode) {
          const id = `state-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          const offset = (nodes.length + newNodes.length) * 20;
          targetNode = { id, type: 'normal', position: { x: 200 + offset, y: 200 + offset }, data: { label: rule.nextStateLabel } };
          newNodes.push(targetNode);
        }
        resolvedRules.push({ ...rule, targetId: targetNode.id });
        if (rule.write && rule.write !== "␣") setManualSymbols(prev => prev.includes(rule.write) ? prev : [...prev, rule.write]);
      }
      if (newNodes.length > 0) setNodes(prev => [...prev, ...newNodes]);
      setManualSymbols(prev => prev.includes(symbol) ? prev : [...prev, symbol]);

      setEdges(prev => {
        // Remove all existing labels with this symbol as read from nodeId
        let updated = prev.map(e => {
          if (e.source !== nodeId) return e;
          const remaining = (e.data?.labels || []).filter(l => l.read !== symbol);
          if (remaining.length === e.data.labels.length) return e; // nothing removed
          if (remaining.length === 0) return { ...e, _delete: true };
          return { ...e, data: { ...e.data, labels: remaining } };
        }).filter(e => !e._delete);

        // Now add each resolved rule as a label on the appropriate edge
        for (const { write, direction, targetId } of resolvedRules) {
          const newLabel = { read: symbol, write, direction };
          const existingEdgeIdx = updated.findIndex(e => e.source === nodeId && e.target === targetId);
          if (existingEdgeIdx !== -1) {
            updated = updated.map((e, i) =>
              i === existingEdgeIdx
                ? { ...e, data: { ...e.data, labels: [...(e.data.labels || []), newLabel] } }
                : e
            );
          } else {
            updated = [...updated, {
              id: `edge-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              source: nodeId,
              target: targetId,
              type: 'draggable',
              "markerEnd": {
              "type": "arrowclosed",
              "color": "#333"
              },
              data: { labels: [newLabel] },
            }];
          }
        }
        return updated;
      });

    } else if (type === "matrix-mt") {
      // multiRegex format: (w,D : w,D) -> nextState  — pass raw value to parse
      // Parse: extract per-tape write/dir pairs and next state
      const arrowIdx = value.lastIndexOf("->"); 
      if (arrowIdx === -1) return;
      const nextStateLabel = value.slice(arrowIdx + 2).trim();
      const innerStr = value.slice(value.indexOf("(") + 1, value.lastIndexOf(")"));
      const tapeParts = innerStr.split(":").map(s => s.trim()); // ["w,D", "w,D", ...]

      let targetNode = nodes.find(n => getNodeLabel(n) === nextStateLabel);
      if (!targetNode) {
        const id = `state-${Date.now()}`;
        targetNode = { id, type: 'normal', position: { x: 200 + nodes.length * 20, y: 200 + nodes.length * 20 }, data: { label: nextStateLabel } };
        setNodes(prev => [...prev, targetNode]);
      }
      const targetId = targetNode.id;

      // tuple is the read-tuple string e.g. "a : b" — split to get per-tape reads
      const readKeys = tuple.split(":").map(s => s.trim());

      setEdges(prev => {
        // Find the edge from nodeId that contains a label matching this read tuple
        const findLabelIdx = (labels) => labels?.findIndex(l => {
          const tapeKeys = Object.keys(l).filter(k => k.startsWith('tape')).sort();
          return tapeKeys.length === readKeys.length && tapeKeys.every((k, i) => l[k]?.read === readKeys[i]);
        }) ?? -1;

        // Remove old label
        let updated = prev.map(e => {
          if (e.source !== nodeId) return e;
          const idx = findLabelIdx(e.data?.labels);
          if (idx === -1) return e;
          const remaining = e.data.labels.filter((_, i) => i !== idx);
          if (remaining.length === 0) return { ...e, _delete: true };
          return { ...e, data: { ...e.data, labels: remaining } };
        }).filter(e => !e._delete);

        // Build new label from parsed tape parts
        const newLabel = {};
        tapeParts.forEach((part, i) => {
          const [w, d] = part.split(",").map(s => s.trim());
          newLabel[`tape${i + 1}`] = { 
            read: readKeys[i] || "␣", // <-- Fallback to blank for new tapes
            write: w || "␣", 
            direction: d || "N" 
          };
        });

        // Add to correct edge
        const existingIdx = updated.findIndex(e => e.source === nodeId && e.target === targetId);
        if (existingIdx !== -1) {
          updated = updated.map((e, i) =>
            i === existingIdx
              ? { ...e, data: { ...e.data, labels: [...(e.data.labels || []), newLabel] } }
              : e
          );
        } else {
          updated = [...updated, {
            id: `edge-${Date.now()}`,
            source: nodeId,
            target: targetId,
            type: 'draggable',
            "markerEnd": {
            "type": "arrowclosed",
            "color": "#333"
            },
            data: { labels: [newLabel] },
          }];
        }
        return updated;
      });

    } else if (type === "list") {
      const rule = allRules[ruleIdx];
      if (!rule) return;

      const readKeys = rule.read.split(" : ").map(s => s.trim());

      const findLabelIdx = (labels) => labels?.findIndex(l => {
        const tapeKeys = Object.keys(l).filter(k => k.startsWith('tape')).sort();
        return tapeKeys.length === readKeys.length && tapeKeys.every((k, i) => l[k]?.read === readKeys[i]);
      }) ?? -1;

      if (field === "end") {
        let targetNode = nodes.find(n => getNodeLabel(n) === value);
        if (!targetNode) {
          const id = `state-${Date.now()}`;
          targetNode = { id, type: 'normal', position: { x: 200 + nodes.length * 20, y: 200 + nodes.length * 20 }, data: { label: value } };
          setNodes(prev => [...prev, targetNode]);
        }
        const targetId = targetNode.id;

        setEdges(prev => {
          // Extract the label from the old edge
          let movedLabel = null;
          let updated = prev.map(e => {
            if (e.source !== rule.startId) return e;
            const idx = findLabelIdx(e.data?.labels);
            if (idx === -1) return e;
            movedLabel = e.data.labels[idx];
            const remaining = e.data.labels.filter((_, i) => i !== idx);
            if (remaining.length === 0) return { ...e, _delete: true };
            return { ...e, data: { ...e.data, labels: remaining } };
          }).filter(e => !e._delete);

          if (!movedLabel) return prev;
          const existingIdx = updated.findIndex(e => e.source === rule.startId && e.target === targetId);
          if (existingIdx !== -1) {
            updated = updated.map((e, i) =>
              i === existingIdx
                ? { ...e, data: { ...e.data, labels: [...(e.data.labels || []), movedLabel] } }
                : e
            );
          } else {
            updated = [...updated, {
              id: `edge-${Date.now()}`,
              source: rule.startId,
              target: targetId,
              type: 'draggable',
              "markerEnd": {
              "type": "arrowclosed",
              "color": "#333"
              },
              data: { labels: [movedLabel] },
            }];
          }
          return updated;
        });

      } else if (field === "write") {
        // value is comma-separated writes per tape e.g. "a, b"
        const writes = value.split(",").map(s => s.trim());
        setEdges(prev => prev.map(e => {
          if (e.source !== rule.startId) return e;
          const idx = findLabelIdx(e.data?.labels);
          if (idx === -1) return e;
          const newLabels = e.data.labels.map((l, i) => {
            if (i !== idx) return l;
            const updated = { ...l };
            Object.keys(updated).filter(k => k.startsWith('tape')).sort().forEach((k, ti) => {
              if (writes[ti] !== undefined) updated[k] = { ...updated[k], write: writes[ti] };
            });
            return updated;
          });
          return { ...e, data: { ...e.data, labels: newLabels } };
        }));

      } else if (field === "direction") {
        // value is comma-separated directions per tape e.g. "L, R"
        const dirs = value.split(",").map(s => s.trim().toUpperCase());
        setEdges(prev => prev.map(e => {
          if (e.source !== rule.startId) return e;
          const idx = findLabelIdx(e.data?.labels);
          if (idx === -1) return e;
          const newLabels = e.data.labels.map((l, i) => {
            if (i !== idx) return l;
            const updated = { ...l };
            Object.keys(updated).filter(k => k.startsWith('tape')).sort().forEach((k, ti) => {
              if (dirs[ti] !== undefined) updated[k] = { ...updated[k], direction: dirs[ti] };
            });
            return updated;
          });
          return { ...e, data: { ...e.data, labels: newLabels } };
        }));

      } else if (field === "read") {
        // value is colon-separated reads per tape e.g. "a : b"
        const newReads = value.split(":").map(s => s.trim());
        setEdges(prev => prev.map(e => {
          if (e.source !== rule.startId) return e;
          const idx = findLabelIdx(e.data?.labels);
          if (idx === -1) return e;
          const newLabels = e.data.labels.map((l, i) => {
            if (i !== idx) return l;
            const updated = { ...l };
            Object.keys(updated).filter(k => k.startsWith('tape')).sort().forEach((k, ti) => {
              if (newReads[ti] !== undefined) updated[k] = { ...updated[k], read: newReads[ti] };
            });
            return updated;
          });
          return { ...e, data: { ...e.data, labels: newLabels } };
        }));

      } else if (field === "start") {
        console.warn("Changing start state from table not yet supported - use the diagram");
      }
    }
  }, [nodes, setNodes, setEdges, setManualSymbols, pushToHistory]);

  return (
    <ReactFlowProvider>
      <div className="visualiser">
        
        {showTable && (
          <TransitionTable 
            nodes={nodes} 
            edges={edges} 
            manualSymbols={manualSymbols}       
            setManualSymbols={setManualSymbols}
            onClose={() => setShowTable(false)} 
            onDeleteSymbol={handleSymbolScrub}
            onReplaceSymbol={handleSymbolReplace}
            onAddState={handleAddState}
            onEditRule={handleEditRule}
            onDeleteNode={handleDeleteNode}
            engine={engine}
          />
        )}

        <div className="tape-container-wrapper">
          <TapeContainer 
            nodes={nodes}
            edges={edges}
            setNodes={setNodes}
            activeNodeId={activeNodeId}
            setActiveNodeId={setActiveNodeId}
            setActiveEdgeId={setActiveEdgeId}
            setCurrentSymbol={setCurrentSymbol}
            setStepCount={setStepCount} 
            loadedInput={loadedInput}
            validAlphabet={validAlphabet}
            engine={engine}
            isRunning={isRunning}
            setIsRunning={setIsRunning}
          />
        </div>

        <div className="diagram-container-wrapper">
          <DiagramContainer 
            key={selectedExample} 
            nodes={nodes} 
            edges={edges} 
            onNodesChange={onNodesChange} 
            onEdgesChange={onEdgesChange}
            setNodes={setNodes}
            setEdges={setEdges}
            activeNodeId={activeNodeId}
            activeEdgeId={activeEdgeId}
            currentSymbol={currentSymbol}
            stepCount={stepCount}
            engine={engine} 
            onClear={handleClear}
            // Pass lock status
            isLocked={isRunning}
            note={note}
            onNoteChange={setNote}
            // Unified history
            history={history}
            future={future}
            pushToHistory={pushToHistory}
            handleUndo={handleUndo}
            handleRedo={handleRedo}
          />
        </div>

      </div>
    </ReactFlowProvider>
  );
}