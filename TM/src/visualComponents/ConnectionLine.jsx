/* src/visualComponents/ConnectionLine.jsx */
import React from 'react';

export default ({ fromX, fromY, toX, toY, fromHandleId }) => {
  // Determine if we are hovering over the source node for a self-loop
  const isSelfLoop = Math.abs(fromX - toX) < 5 && Math.abs(fromY - toY) < 5;

  let path;
  if (isSelfLoop) {
    // Logic matching DraggableEdge.jsx to keep the loop outside the node
    const loopDist = 60;
    const spread = 45;
    let bx = fromX;
    let by = fromY;

    // Determine direction based on handle ID (T, B, L, R)
    if (fromHandleId?.includes('T')) by -= loopDist;
    else if (fromHandleId?.includes('B')) by += loopDist;
    else if (fromHandleId?.includes('L')) bx -= loopDist;
    else if (fromHandleId?.includes('R')) bx += loopDist;
    else by -= loopDist; // Default to top

    // Create a smooth cubic bezier curve for the preview
    // We offset the control points horizontally or vertically to create the "tear drop" shape
    const isVertical = fromHandleId?.includes('T') || fromHandleId?.includes('B') || !fromHandleId;
    const c1 = { x: isVertical ? bx - spread : bx, y: isVertical ? by : by - spread };
    const c2 = { x: isVertical ? bx + spread : bx, y: isVertical ? by : by + spread };

    path = `M${fromX},${fromY} C${c1.x},${c1.y} ${c2.x},${c2.y} ${toX},${toY}`;
  } else {
    // Standard straight line for normal connections
    path = `M${fromX},${fromY} L${toX},${toY}`;
  }

  return (
    <g>
      <path
        fill="none"
        stroke="#333" // Solid black line
        strokeWidth={2}
        d={path}
      />
      {/* Optional: Add a small circle at the end of the preview line */}
      <circle cx={toX} cy={toY} fill="#fff" r={3} stroke="#333" strokeWidth={1.5} />
    </g>
  );
};