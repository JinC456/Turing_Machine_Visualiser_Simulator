/* src/visualComponents/DraggableEdge.jsx */
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
  const threadColors = data?.threadColors || [];
  const activeThreads = data?.activeThreads || []; 

  let px, py;
  let path;

  // --- Path Calculation Logic ---
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
      {/* 1. DRAW WIRES (Concentric) - Show ALL threads traversing this edge */}
      {threadColors.length > 0 ? (
          threadColors.map((color, idx) => {
            const width = 3 + (threadColors.length - 1 - idx) * 3;
            const isTop = idx === threadColors.length - 1;
            return (
              <path
                key={`edge-${idx}`}
                d={path}
                className="edge-path active-thread"
                style={{ 
                    stroke: color, 
                    strokeWidth: width,
                    transition: 'stroke-width 0.2s, stroke 0.2s',
                    fill: 'none'
                }}
                markerEnd={isTop ? markerEnd : undefined} 
              />
            );
          })
      ) : (
          <path
            key={`path-${id}-${stepCount}`} 
            d={path}
            className={`edge-path ${selected ? 'selected' : ''} ${data?.isActive ? 'active' : ''}`}
            markerEnd={markerEnd}
          />
      )}
      
      {/* Hitbox */}
      <path d={path} className="edge-hitbox" />
      
      {labels.map((label, index) => {
        let labelText = "";
        let isRuleActive = false;
        let badgeColors = [];

        // --- DETERMINE LABEL TEXT ---
        const tapeKeys = Object.keys(label).filter(k => k.startsWith('tape')).sort();
        if (tapeKeys.length > 0) {
            const parts = tapeKeys.map(k => {
                const t = label[k];
                return `${t.read},${t.write},${t.direction}`;
            });
            labelText = `(${parts.join(' : ')})`;
        } else {
            labelText = `${label.read}, ${label.write}, ${label.direction}`;
        }

        // --- DETERMINE ACTIVE STATE PER LABEL ---
        if (activeThreads.length > 0) {
            // NTM: Filter threads that specifically used *this* label
            const matchingThreads = activeThreads.filter(t => {
                if (!t.lastRule) return false;
                return JSON.stringify(t.lastRule) === JSON.stringify(label);
            });
            
            if (matchingThreads.length > 0) {
                isRuleActive = true;
                badgeColors = matchingThreads.map(t => t.color);
            }
        } 
        else if (data?.isActive) {
            // Deterministic Fallback (Single Symbol Check)
            if (tapeKeys.length > 0) {
                if (data.activeSymbol) {
                    const currentReads = data.activeSymbol.split(",");
                    let allMatch = true;
                    tapeKeys.forEach((k, i) => {
                        const t = label[k];
                        const r = currentReads[i] || ""; 
                        if (t.read !== r && !(t.read === "␣" && r === '')) allMatch = false;
                    });
                    isRuleActive = allMatch;
                }
            } else {
                isRuleActive = (label.read === data.activeSymbol || 
                               (label.read === "␣" && data.activeSymbol === ""));
            }
        }

        // --- Positioning ---
        let lx = px;
        let ly = py;
        const totalHeight = labels.length * labelSpacing;
        const centeredY = py - (totalHeight / 2) + (index * labelSpacing) + (labelSpacing / 2);

        if (dir === 'top')    ly = py - 15 - (index * labelSpacing); 
        else if (dir === 'bottom') ly = py + 25 + (index * labelSpacing);
        else if (dir === 'left') { lx = px - 55; ly = centeredY; }
        else if (dir === 'right') { lx = px + 55; ly = centeredY; }
        else ly = py - 15 - (index * labelSpacing);

        const textWidth = labelText.length * 7; 
        const badgeStartX = lx + (textWidth / 2) + 8;

        return (
          <g key={`${index}-${stepCount}`} style={{ pointerEvents: "none", userSelect: "none" }}>
            {/* Outline */}
            <text x={lx} y={ly} textAnchor="middle" stroke="white" strokeWidth="4" fontSize={12} fontWeight={isRuleActive ? "bold" : "normal"}>
              {labelText}
            </text>
            
            {/* Text: Falls back to Yellow if active but no badges (DTM), else Black */}
            <text 
              x={lx} 
              y={ly} 
              textAnchor="middle" 
              fill={(isRuleActive && badgeColors.length === 0) ? "#cde81a" : "black"} 
              fontSize={12} 
              fontWeight={isRuleActive ? "bold" : "normal"}
            >
              {labelText}
            </text>

            {/* BADGES: Only for the specific threads on this specific rule */}
            {isRuleActive && badgeColors.length > 0 && (
                <g>
                   {badgeColors.map((color, idx) => (
                     <circle
                       key={`badge-${idx}`}
                       cx={badgeStartX + (idx * 10)} 
                       cy={ly - 4}
                       r={4}
                       fill={color}
                       stroke="white"
                       strokeWidth="1"
                     />
                   ))}
                </g>
            )}
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