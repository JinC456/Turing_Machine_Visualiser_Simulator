import React from 'react';

export default function TapeDisplay({ tape, head }) {
  return (
    <div className="tape-display">
      <p>This is the tape display</p>
      {/* Example rendering of tape */}
      <div style={{ display: 'flex', gap: '5px' }}>
        {tape.map((cell, index) => (
          <div 
            key={index} 
            style={{ padding: '5px', border: head === index ? '2px solid red' : '1px solid black' }}
          >
            {cell}
          </div>
        ))}
      </div>
    </div>
  );
}
