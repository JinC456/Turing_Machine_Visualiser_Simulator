// ... (Imports and helper functions remain the same)
import React, { useContext, createContext, useCallback } from 'react';
import { useReactFlow } from 'reactflow';

export const HistoryContext = createContext(null);

function getLoopDirection(handleId) {
  if (!handleId) return 'top';
  if (handleId.includes('B')) return 'bottom';
  if (handleId.includes('T')) return 'top';
  if (handleId.includes('L')) return 'left';
  if (handleId.includes('R')) return 'right';
  return 'top';
}

function findControlPoint(sourceX, sourceY, targetX, targetY, px, py, t) {
  if (sourceX === targetX && sourceY === targetY) {
    return { cx: px, cy: py };
  }
  const cx = (px - (1 - t) ** 2 * sourceX - t ** 2 * targetX) / (2 * t * (1 - t));
  const cy = (py - (1 - t) ** 2 * sourceY - t ** 2 * targetY) / (2 * t * (1 - t));
  return { cx, cy };
}

export default function DraggableEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourceHandleId,
  markerEnd,
  data,
  selected,
}) {
  const { setEdges, getZoom, getEdge } = useReactFlow();
  const pushToHistory = useContext(HistoryContext);

  const edge = getEdge(id);
  const isSelfLoop = source === target;
  const dir = isSelfLoop ? getLoopDirection(sourceHandleId) : 'top';

  const t = edge?.data?.t ?? 0.5;
  const dxOffset = edge?.data?.dxOffset ?? 0;
  const dyOffset = edge?.data?.dyOffset ?? 0;
  
  const stepCount = data?.stepCount;

  let px, py;
  let path;

  // ... (Path calculation logic for SelfLoop and Normal edges remains same) ...
  if (isSelfLoop) {
    const loopDist = 60; 
    let baseX = sourceX;
    let baseY = sourceY;

    if (dir === 'top')    baseY -= loopDist;
    if (dir === 'bottom') baseY += loopDist;
    if (dir === 'left')   baseX -= loopDist;
    if (dir === 'right')  baseX += loopDist;

    px = baseX + dxOffset;
    py = baseY + dyOffset;

    const P0 = { x: sourceX, y: sourceY };
    const P3 = { x: targetX, y: targetY };
    const H = { x: px, y: py };

    const spread = 45; 
    let C1 = { x: H.x, y: H.y };

    const isReversedX = P0.x > P3.x; 
    const isReversedY = P0.y > P3.y;

    if (dir === 'top' || dir === 'bottom') {
      if (isReversedX) C1.x += spread; 
      else C1.x -= spread;             
    } else {
      if (isReversedY) C1.y += spread; 
      else C1.y -= spread;             
    }

    const C2 = {
      x: (H.x - 0.125 * P0.x - 0.375 * C1.x - 0.125 * P3.x) / 0.375,
      y: (H.y - 0.125 * P0.y - 0.375 * C1.y - 0.125 * P3.y) / 0.375,
    };

    path = `M${P0.x},${P0.y} C${C1.x},${C1.y} ${C2.x},${C2.y} ${P3.x},${P3.y}`;
  } else {
    px = edge?.data?.px !== undefined ? edge.data.px + dxOffset : sourceX * (1 - t) + targetX * t + dxOffset;
    py = edge?.data?.py !== undefined ? edge.data.py + dyOffset : sourceY * (1 - t) + targetY * t + dyOffset;

    const { cx, cy } = findControlPoint(sourceX, sourceY, targetX, targetY, px, py, t);
    path = `M${sourceX},${sourceY} Q${cx},${cy} ${targetX},${targetY}`;
  }

  const onPointerDown = useCallback((event) => {
    event.stopPropagation();
    const targetEl = event.target;
    targetEl.setPointerCapture(event.pointerId);

    const zoom = getZoom();
    const startX = event.clientX;
    const startY = event.clientY;
    const initialDx = dxOffset;
    const initialDy = dyOffset;

    if (pushToHistory) pushToHistory();

    const onPointerMove = (moveEvent) => {
      const deltaX = (moveEvent.clientX - startX) / zoom;
      const deltaY = (moveEvent.clientY - startY) / zoom;

      setEdges((eds) =>
        eds.map((e) => {
          if (e.id !== id) return e;
          return {
            ...e,
            data: {
              ...e.data,
              dxOffset: initialDx + deltaX,
              dyOffset: initialDy + deltaY,
            },
          };
        })
      );
    };

    const onPointerUp = (upEvent) => {
      targetEl.releasePointerCapture(upEvent.pointerId);
      targetEl.removeEventListener('pointermove', onPointerMove);
      targetEl.removeEventListener('pointerup', onPointerUp);
    };

    targetEl.addEventListener('pointermove', onPointerMove);
    targetEl.addEventListener('pointerup', onPointerUp);
  }, [id, dxOffset, dyOffset, setEdges, getZoom, pushToHistory]);

  const labels = edge?.data?.labels ?? [];
  const labelSpacing = 16; 

  return (
    <>
      <path
        key={`path-${id}-${stepCount}`} 
        d={path}
        className={`edge-path ${selected ? 'selected' : ''} ${data?.isActive ? 'active' : ''}`}
        markerEnd={markerEnd}
      />
      
      <path d={path} className="edge-hitbox" />
      
      {labels.map((label, index) => {
        let labelText = "";
        let isRuleActive = false;

        // Check if label has any tape keys
        const tapeKeys = Object.keys(label).filter(k => k.startsWith('tape')).sort();
        
        if (tapeKeys.length > 0) {
            // Multi-Tape Format: (1,0,L : 1,1,R : ...)
            const parts = tapeKeys.map(k => {
                const t = label[k];
                return `${t.read},${t.write},${t.direction}`;
            });
            labelText = `(${parts.join(' : ')})`;

            if (data?.isActive && data?.activeSymbol) {
                // activeSymbol is comma joined string of reads: "a,b,c"
                const currentReads = data.activeSymbol.split(",");
                // Check if all parts match
                let allMatch = true;
                tapeKeys.forEach((k, i) => {
                    const t = label[k];
                    const r = currentReads[i] || ""; // might be undefined if sim has more tapes than rule?
                    if (t.read !== r && !(t.read === "␣" && r === '')) {
                        allMatch = false;
                    }
                });
                isRuleActive = allMatch;
            }
        } else {
            // Standard Format
            labelText = `${label.read}, ${label.write}, ${label.direction}`;
            isRuleActive = data?.isActive && (
                label.read === data.activeSymbol || 
                (label.read === "␣" && data.activeSymbol === "")
            );
        }

        // --- Positioning Logic ---
        let lx = px;
        let ly = py;
        const totalHeight = labels.length * labelSpacing;
        const centeredY = py - (totalHeight / 2) + (index * labelSpacing) + (labelSpacing / 2);

        if (dir === 'top') {
           ly = py - 15 - (index * labelSpacing); 
        } else if (dir === 'bottom') {
           ly = py + 25 + (index * labelSpacing);
        } else if (dir === 'left') {
           lx = px - 55; 
           ly = centeredY;
        } else if (dir === 'right') {
           lx = px + 55; 
           ly = centeredY;
        } else {
           ly = py - 15 - (index * labelSpacing);
        }

        return (
          <g key={`${index}-${stepCount}`} style={{ pointerEvents: "none", userSelect: "none" }}>
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              stroke="white"
              strokeWidth="4" 
              fontSize={isRuleActive ? 14 : 12}
              fontWeight={isRuleActive ? "bold" : "normal"}
              style={{ transition: "all 0.2s ease" }}
            >
              {labelText}
            </text>
            
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              fill={isRuleActive ? "#cde81a" : "#000"}
              fontSize={isRuleActive ? 14 : 12}
              fontWeight={isRuleActive ? "bold" : "normal"}
              style={{ transition: "all 0.2s ease" }}
            >
              {labelText}
            </text>
          </g>
        );
      })}

      {selected && (
        <circle 
          className="edge-handle" 
          cx={px} 
          cy={py} 
          onPointerDown={onPointerDown} 
          r={5}
        />
      )}
    </>
  );
}