
import React, { useRef, useEffect } from "react";
import "../Visualiser.css";


const FOLD_COLOURS = {
  origin:    "rgba(255, 255, 255, 0.85)",
  odd:       "rgba(166, 253, 147, 0.35)", 
  even:      "rgba(249, 254, 180, 0.35)", 
  preOrigin: "rgba(100, 100, 100, 0.18)", 
};

function getFoldBackground(index, isActive, oneWay, oneWayColours, firstPipeIndex) {
  if ((!oneWay && !oneWayColours) || isActive) return undefined;
  if (index === firstPipeIndex) return FOLD_COLOURS.origin;
  if (index < firstPipeIndex) return FOLD_COLOURS.preOrigin;
  // relative index from the first | determines blue/purple alternation
  const rel = index - firstPipeIndex;
  return rel % 2 === 1 ? FOLD_COLOURS.odd : FOLD_COLOURS.even;
}

export default function TapeDisplay({ tape, head, activeLabel, cellSize = 40, width = "80vw", instantScroll = false, oneWay = false, oneWayColours = false }) {
  const prevHead = useRef(head);
  const wrapperRef = useRef(null);
  const isJump = Math.abs(head - prevHead.current) > 1;

  useEffect(() => {
    prevHead.current = head;
  }, [head]);

  const displayLabel = activeLabel === "" ? "" : (activeLabel || "START");

  // Index of the first '|' separator — used for single-tape colour banding
  const firstPipeIndex = (oneWay || oneWayColours) ? tape.indexOf('|') : -1;

  // ── One-way mode layout ───────────────────────────────────────────────────
  // headOffset is where the arrow sits (in px from the left edge of the wrapper).
  // We clamp it so it never exceeds cellSize*3, and we always leave at least
  // cellSize px of room so index-0 is never hidden behind the left border.
  const headOffset = oneWay ? Math.max(cellSize, Math.min(head * cellSize + cellSize, cellSize * 4)) : null;
  const tapeLeft   = oneWay
    ? `${Math.max(cellSize, headOffset - head * cellSize)}px`
    : `calc(50% - ${cellSize / 2}px)`;
  const tapeShift  = oneWay
    ? `translateX(0px)`
    : `translateX(${-head * cellSize}px)`;

  const arrowStyle = oneWay
    ? { position: 'absolute', top: '-48px', left: headOffset - cellSize / 2 - cellSize, transform: 'none', zIndex: 100, pointerEvents: 'none' }
    : undefined;

  return (
    <div style={{ position: 'relative', width: width, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      {oneWay ? (
        <div style={arrowStyle}>
          <div className="tape-pointer">
            {displayLabel && <div className="tape-start-label">{displayLabel}</div>}
            <div className="tape-arrow">▼</div>
          </div>
        </div>
      ) : (
        <div className="tape-header">
          <div className="tape-pointer">
            {displayLabel && <div className="tape-start-label">{displayLabel}</div>}
            <div className="tape-arrow">▼</div>
          </div>
        </div>
      )}

      <div 
        ref={wrapperRef} 
        className="tape-wrapper" 
        style={{ width: "100%", borderLeft: oneWay ? '3px solid #555' : undefined }}
      >
        <div
          className="tape"
          style={{ 
            left: tapeLeft,
            transform: tapeShift,
            transition: instantScroll || isJump ? "none" : "transform 0.3s ease-in-out",
            height: `${cellSize}px` 
          }}
        >
          {tape.map((symbol, index) => {
            const hasMarker = typeof symbol === 'string' && symbol.includes('^');
            const cleanSymbol = hasMarker ? symbol.replace('^', '') : symbol;
            const displaySymbol = cleanSymbol === '␣' ? " " : cleanSymbol;
            const isActive = index === head;

            return (
              <div
                key={index}
                className={`cell ${isActive ? "active" : ""}`}
                style={{ 
                  width: `${cellSize}px`,
                  height: `${cellSize}px`,
                  fontSize: `${cellSize * 0.45}px`,
                  backgroundColor: getFoldBackground(index, isActive, oneWay, oneWayColours, firstPipeIndex),
                }}
              >
                <div className="cell-content-wrapper">
                  {hasMarker && <span className="diacritic-marker">^</span>}
                  {displaySymbol || ""}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}