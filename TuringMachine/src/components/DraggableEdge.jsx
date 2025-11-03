import React from 'react';
import { useReactFlow, useStoreApi } from 'reactflow';
import Draggable from 'react-draggable';

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

  const px =
    sourceX + (edge?.data?.pxOffset ?? (edge?.data?.px ? edge.data.px - sourceX : (targetX - sourceX) / 2));
  const py =
    sourceY + (edge?.data?.pyOffset ?? (edge?.data?.py ? edge.data.py - sourceY : (targetY - sourceY) / 2));

  const { cx, cy } = findControlPoint(sourceX, sourceY, targetX, targetY, px, py, t);

  const path = `M${sourceX},${sourceY} Q${cx},${cy} ${targetX},${targetY}`;

  const onDrag = (e, dragData) => {
    const { transform } = store.getState();
    const zoom = transform[2];
    const deltaX = dragData.deltaX / zoom;
    const deltaY = dragData.deltaY / zoom;

    const newPxOffset = (px - sourceX) + deltaX;
    const newPyOffset = (py - sourceY) + deltaY;

    setEdges((eds) =>
      eds.map((edge) =>
        edge.id === id
          ? {
              ...edge,
              data: {
                ...edge.data,
                pxOffset: newPxOffset,
                pyOffset: newPyOffset,
                t,
              },
            }
          : edge
      )
    );
  };

  return (
    <>
      <path
        d={path}
        stroke="#333"
        strokeWidth={2}
        fill="none"
        markerStart={markerStart}
        markerEnd={markerEnd}
        style={selected ? { stroke: 'blue', strokeWidth: 3 } : {}}
      />
      <path d={path} stroke="transparent" strokeWidth={20} fill="none" />

      {selected && (
        <Draggable
          position={{ x: px, y: py }}
          onDrag={onDrag}
          onStart={(e) => e.stopPropagation()}
          onStop={(e) => e.stopPropagation()}
        >
          <circle
            r={8}
            fill="white"
            stroke="blue"
            strokeWidth={2}
            cursor="grab"
            style={{ pointerEvents: 'all' }}
          />
        </Draggable>
      )}
    </>
  );
}
