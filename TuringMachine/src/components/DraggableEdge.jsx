import React from 'react';
import { useReactFlow, useStoreApi } from 'reactflow';
import Draggable from 'react-draggable';

export default function DraggableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  data,
}) {
  const { setEdges } = useReactFlow();
  const store = useStoreApi();

  // Fetch latest edge data from store to avoid snapping
  const edges = store.getState().edges;
  const edge = edges.find(e => e.id === id);

  const controlX = (sourceX + targetX) / 2; // keep fixed
  const controlY = edge?.data?.controlY ?? (sourceY + targetY) / 2;

  const onDrag = (e, dragData) => {
    const { transform } = store.getState();
    const zoom = transform[2];
    const deltaY = dragData.deltaY / zoom;

    setEdges((eds) =>
      eds.map((e) => {
        if (e.id === id) {
          return {
            ...e,
            data: {
              ...e.data,
              controlY: (e.data?.controlY ?? (sourceY + targetY) / 2) + deltaY,
            },
          };
        }
        return e;
      })
    );
  };

  const path = `M${sourceX},${sourceY} Q${controlX},${controlY} ${targetX},${targetY}`;

  return (
    <>
      <path
        d={path}
        className="react-flow__edge-path"
        markerEnd={markerEnd}
        stroke="#333"
        strokeWidth={2}
        fill="none"
      />

      <Draggable
        axis="y"
        position={{ x: controlX, y: controlY }}
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
    </>
  );
}
