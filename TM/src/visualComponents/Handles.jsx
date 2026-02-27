import React, { useEffect } from "react";
import { Handle, Position } from "reactflow";

export function useAutoFontSize(labelRef, label) {
  useEffect(() => {
    // Defer to after layout so clientWidth/scrollWidth are real values.
    // This also batches the reflow cost across frames when many nodes mount at once.
    const raf = requestAnimationFrame(() => {
      const element = labelRef.current;
      const parent = element?.parentElement;
      if (!element || !parent) return;
      // Skip if parent has no size yet (off-screen or unmeasured)
      if (parent.clientWidth === 0 || parent.clientHeight === 0) return;

      const MIN = 8;
      const MAX = 16;

      let min = MIN;
      let max = MAX;
      let best = MIN;

      while (min <= max) {
        const mid = (min + max) / 2;
        element.style.fontSize = `${mid}px`;

        if (
          element.scrollWidth <= parent.clientWidth &&
          element.scrollHeight <= parent.clientHeight
        ) {
          best = mid;
          min = mid + 0.5;
        } else {
          max = mid - 0.5;
        }
      }

      element.style.fontSize = `${best}px`;
    });

    return () => cancelAnimationFrame(raf);
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