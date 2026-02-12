import React, { useLayoutEffect } from "react";
import { Handle, Position } from "reactflow";

// --- Shared Hook for Node Font Sizing ---
export function useAutoFontSize(labelRef, label) {
  useLayoutEffect(() => {
    const element = labelRef.current;
    const parent = element?.parentElement;

    if (!element || !parent) return;

    let currentFontSize = 16;
    element.style.fontSize = `${currentFontSize}px`;

    while (
      (element.scrollWidth > parent.clientWidth || element.scrollHeight > parent.clientHeight) &&
      currentFontSize > 8
    ) {
      currentFontSize -= 0.5;
      element.style.fontSize = `${currentFontSize}px`;
    }
  }, [label]);
}

export default function Handles({ showLeft }) {
  return (
    <>
      {showLeft && <Handle type="target" position={Position.Left} id="L" style={{ left: '4%', top: '50%', transform: 'translate(-50%, -50%)' }} /> }
      {showLeft && <Handle type="source" position={Position.Left} id="L" style={{ left: '4%', top: '50%', transform: 'translate(-50%, -50%)' }} />}

      <Handle type="target" position={Position.Right} id="R" style={{ left: '96%', top: '50%', transform: 'translate(-50%, -50%)' }} />
      <Handle type="source" position={Position.Right} id="R" style={{ left: '96%', top: '50%', transform: 'translate(-50%, -50%)' }} />

      <Handle type="target" position={Position.Top} id="T" style={{ left: '50%', top: '4%', transform: 'translate(-50%, -50%)' }} />
      <Handle type="source" position={Position.Top} id="T" style={{ left: '50%', top: '4%', transform: 'translate(-50%, -50%)' }} />

      <Handle type="target" position={Position.Bottom} id="B" style={{ left: '50%', top: '96%', transform: 'translate(-50%, -50%)' }} />
      <Handle type="source" position={Position.Bottom} id="B" style={{ left: '50%', top: '96%', transform: 'translate(-50%, -50%)' }} />

      <Handle type="target" position={Position.Top} id="TL" style={{ left: '18%', top: '18%', transform: 'translate(-50%, -50%)' }} />
      <Handle type="source" position={Position.Top} id="TL" style={{ left: '18%', top: '18%', transform: 'translate(-50%, -50%)' }} />

      <Handle type="target" position={Position.Top} id="TR" style={{ left: '82%', top: '18%', transform: 'translate(-50%, -50%)' }} />
      <Handle type="source" position={Position.Top} id="TR" style={{ left: '82%', top: '18%', transform: 'translate(-50%, -50%)' }} />

      <Handle type="target" position={Position.Bottom} id="BL" style={{ left: '18%', top: '82%', transform: 'translate(-50%, -50%)' }} />
      <Handle type="source" position={Position.Bottom} id="BL" style={{ left: '18%', top: '82%', transform: 'translate(-50%, -50%)' }} />
      
      <Handle type="target" position={Position.Bottom} id="BR" style={{ left: '82%', top: '82%', transform: 'translate(-50%, -50%)' }} />
      <Handle type="source" position={Position.Bottom} id="BR" style={{ left: '82%', top: '82%', transform: 'translate(-50%, -50%)' }} />
    </>
  );
}