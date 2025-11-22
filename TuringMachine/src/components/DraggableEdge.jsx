import React from 'react';
import { useReactFlow, useStoreApi } from 'reactflow';
import Draggable from 'react-draggable';

// calculates C-point for quadratic Bezier based on start/end nodes and a point on the curve
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
  const { setEdges } = useReactFlow();
  const store = useStoreApi();

  const edges = store.getState().edges;
  const edge = edges.find((e) => e.id === id);

  const t = edge?.data?.t ?? 0.5;

  // Offsets relative to the linear interpolation between source and target
  const dxOffset = edge?.data?.dxOffset ?? 0;
  const dyOffset = edge?.data?.dyOffset ?? 0;

  // Linear interpolation along the edge
  const baseX = sourceX * (1 - t) + targetX * t;
  const baseY = sourceY * (1 - t) + targetY * t;

  // Apply offsets to get draggable handle position
  const px = baseX + dxOffset;
  const py = baseY + dyOffset;

  // Compute quadratic control point
  const { cx, cy } = findControlPoint(sourceX, sourceY, targetX, targetY, px, py, t);

  const path = `M${sourceX},${sourceY} Q${cx},${cy} ${targetX},${targetY}`;

  const onDrag = (e, dragData) => {
    const { transform } = store.getState();
    const zoom = transform[2];
    const deltaX = dragData.deltaX / zoom;
    const deltaY = dragData.deltaY / zoom;

    const newDxOffset = dxOffset + deltaX;
    const newDyOffset = dyOffset + deltaY;

    setEdges((eds) =>
      eds.map((edge) =>
        edge.id === id
          ? {
              ...edge,
              data: {
                ...edge.data,
                dxOffset: newDxOffset,
                dyOffset: newDyOffset,
                t,
              },
            }
          : edge
      )
    );
  };

  const labels = edge?.data?.labels ?? [];
  const labelOffsetY = -15;
  const labelSpacing = 14;

  return (
    <>
      {/* The actual curve */}
      <path
        d={path}
        className={`edge-path ${selected ? 'selected' : ''}`}
        markerStart={markerStart}
        markerEnd={markerEnd}
      />
      {/* Hitbox for easier dragging / selection */}
      <path d={path} className="edge-hitbox" />

      {/* Labels follow draggable handle */}
      {labels.map((label, index) => (
        <text
          key={index}
          x={px}
          y={py + labelOffsetY - index * labelSpacing}
          textAnchor="middle"
          fontSize={12}
          fill="#000"
        >
          {`${label.read}, ${label.write}, ${label.direction}`}
        </text>
      ))}

      {/* Draggable handle */}
      {selected && (
        <Draggable
          position={{ x: px, y: py }}
          onDrag={onDrag}
          onStart={(e) => e.stopPropagation()}
          onStop={(e) => e.stopPropagation()}
        >
          <circle className="edge-handle" />
        </Draggable>
      )}
    </>
  );
}
