import React, { useContext, createContext, useCallback } from 'react';
import { useReactFlow } from 'reactflow';

export const HistoryContext = createContext(null);

function findControlPoint(sourceX, sourceY, targetX, targetY, px, py, t) {
  const cx =
    (px - (1 - t) ** 2 * sourceX - t ** 2 * targetX) / (2 * t * (1 - t));
  const cy =
    (py - (1 - t) ** 2 * sourceY - t ** 2 * targetY) / (2 * t * (1 - t));
  return { cx, cy };
}

export default function DraggableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerStart,
  markerEnd,
  data,
  selected,
}) {
  const { setEdges, getZoom, getEdge } = useReactFlow();
  const pushToHistory = useContext(HistoryContext);

  const edge = getEdge(id);

  const t = edge?.data?.t ?? 0.5;
  const dxOffset = edge?.data?.dxOffset ?? 0;
  const dyOffset = edge?.data?.dyOffset ?? 0;

  const px = edge?.data?.px !== undefined ? edge.data.px + dxOffset : sourceX * (1 - t) + targetX * t + dxOffset;
  const py = edge?.data?.py !== undefined ? edge.data.py + dyOffset : sourceY * (1 - t) + targetY * t + dyOffset;

  const { cx, cy } = findControlPoint(sourceX, sourceY, targetX, targetY, px, py, t);

  const path = `M${sourceX},${sourceY} Q${cx},${cy} ${targetX},${targetY}`;

  const onPointerDown = useCallback((event) => {
    event.stopPropagation();
    
    const target = event.target;
    target.setPointerCapture(event.pointerId);

    const zoom = getZoom();
    const startX = event.clientX;
    const startY = event.clientY;
    const initialDx = dxOffset;
    const initialDy = dyOffset;

    if (pushToHistory) {
        pushToHistory();
    }

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
                        t,
                    },
                };
            })
        );
    };

    const onPointerUp = (upEvent) => {
        target.releasePointerCapture(upEvent.pointerId);
        target.removeEventListener('pointermove', onPointerMove);
        target.removeEventListener('pointerup', onPointerUp);
    };

    target.addEventListener('pointermove', onPointerMove);
    target.addEventListener('pointerup', onPointerUp);
  }, [id, dxOffset, dyOffset, setEdges, getZoom, pushToHistory, t]);

  const labels = edge?.data?.labels ?? [];
  const labelOffsetY = -15;
  const labelSpacing = 14;

  return (
    <>
      <path
        d={path}
        className={`edge-path ${selected ? 'selected' : ''} ${data?.isActive ? 'active' : ''}`}
        markerStart={markerStart}
        markerEnd={markerEnd}
      />
      
      <path d={path} className="edge-hitbox" />

      {labels.map((label, index) => {
        // Define the logic to check if this specific rule is the one being used
        const isRuleActive = data?.isActive && (
          label.read === data.activeSymbol || 
          (label.read === '*' && data.activeSymbol === "")
        );

        return (
          <text
            key={index}
            x={px}
            y={py + labelOffsetY - index * labelSpacing}
            textAnchor="middle"
            fill={isRuleActive ? "#cde81a" : "#000"} // Highlight color matching your CSS
            fontWeight={isRuleActive ? "bold" : "normal"}
            fontSize={isRuleActive ? 14 : 12}
            style={{ transition: "all 0.2s ease", pointerEvents: "none", userSelect: "none" }}
          >
            {`${label.read}, ${label.write}, ${label.direction}`}
          </text>
        );
      })}

      {selected && (
        <circle 
            className="edge-handle"
            cx={px}
            cy={py}
            onPointerDown={onPointerDown}
        />
      )}
    </>
  );
}