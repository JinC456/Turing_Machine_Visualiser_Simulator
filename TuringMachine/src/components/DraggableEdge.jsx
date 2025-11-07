import React from 'react';
import { useReactFlow, useStoreApi } from 'reactflow';
import Draggable from 'react-draggable';

// calculates C-point based off start/end node and position of point on edge
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
  const { setEdges } = useReactFlow(); //updates edges
  const store = useStoreApi();

  const edges = store.getState().edges;
  const edge = edges.find((e) => e.id === id);

  //t = position of control point relative to start and end
  const t = edge?.data?.t ?? 0.5; //if there is no t default to middle

  //co-ords for draggable handle, default to middle
  const px =
    sourceX + (edge?.data?.pxOffset ?? (edge?.data?.px ? edge.data.px - sourceX : (targetX - sourceX) / 2));
  const py =
    sourceY + (edge?.data?.pyOffset ?? (edge?.data?.py ? edge.data.py - sourceY : (targetY - sourceY) / 2));

  //calculates bezier curve control point
  const { cx, cy } = findControlPoint(sourceX, sourceY, targetX, targetY, px, py, t);

  //build path for bezier curve using control point calculated
  const path = `M${sourceX},${sourceY} Q${cx},${cy} ${targetX},${targetY}`;

  //handles dragging for point
  const onDrag = (e, dragData) => {
    const { transform } = store.getState();
    const zoom = transform[2];
    const deltaX = dragData.deltaX / zoom;
    const deltaY = dragData.deltaY / zoom;

    const newPxOffset = (px - sourceX) + deltaX;
    const newPyOffset = (py - sourceY) + deltaY;

    //updates edges with new offsets
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
        className={`edge-path ${selected ? "selected" : ""}`}
        markerStart={markerStart}
        markerEnd={markerEnd}
      />
      {/* hit box for mouse interactions */}
      <path d={path} className="edge-hitbox" />

      {/*control the selected edge*/}
      {selected && (
        <Draggable
          position={{ x: px, y: py }}
          onDrag={onDrag}
          onStart={(e) => e.stopPropagation()} //stops interaction with background canvas
          onStop={(e) => e.stopPropagation()}
        >
          <circle className="edge-handle" />
        </Draggable>
      )}
    </>
  );
}
