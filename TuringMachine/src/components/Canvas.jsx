import React from 'react';
import { useReactFlow, useStoreApi } from 'https://cdn.esm.sh/reactflow@11';
import Draggable from 'https://cdn.esm.sh/react-draggable@4';

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

 // Compute offsets if present
 const px =
  sourceX + (edge?.data?.pxOffset ?? (edge?.data?.px ? edge.data.px - sourceX : (targetX - sourceX) / 2));
 const py =
  sourceY + (edge?.data?.pyOffset ?? (edge?.data?.py ? edge.data.py - sourceY : (targetY - sourceY) / 2));

 const { cx, cy } = findControlPoint(sourceX, sourceY, targetX, targetY, px, py, t);

  const offset = 2; // The 2px offset

  // --- Updated (and more direct) offset logic ---
  // Calculate the length from the control point to the source
  const L1 = Math.sqrt((sourceX - cx) ** 2 + (sourceY - cy) ** 2);
  // Calculate the length from the control point to the target
  const L2 = Math.sqrt((targetX - cx) ** 2 + (targetY - cy) ** 2);

  // Calculate new start point (sX_new, sY_new) by moving 2px along the line from the control point
  const sX_new = L1 > 0 ? sourceX + offset * (sourceX - cx) / L1 : sourceX;
  const sY_new = L1 > 0 ? sourceY + offset * (sourceY - cy) / L1 : sourceY;

  // Calculate new end point (tX_new, tY_new) by moving 2px along the line from the control point
  const tX_new = L2 > 0 ? targetX + offset * (targetX - cx) / L2 : targetX;
  const tY_new = L2 > 0 ? targetY + offset * (targetY - cy) / L2 : targetY;
  // --- End of updated logic ---

  // The new path definition using the offset points
 const path = `M${sX_new},${sY_new} Q${cx},${cy} ${tX_new},${tY_new}`;

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
        // --- Reverted marker swap ---
    markerStart={markerStart} // Back to original
    markerEnd={markerEnd} // Back to original
    style={selected ? { stroke: 'blue', strokeWidth: 3 } : {}}
   />
   {/* This path is the invisible, wider hitbox for dragging */}
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
            className=""
     />
    </Draggable>
   )}
  </>
 );
}


