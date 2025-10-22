import React, { useState } from 'react';

// Import your components
import TapeContainer from './components/TapeContainer';
import DiagramContainer from './components/DiagramContainer';
import './Visualiser.css';


export default function Visualiser() {
  // Example placeholder states (empty arrays or defaults)
  const [nodes, setNodes] = useState([]);       // For diagram nodes
  const [edges, setEdges] = useState([]);       // For diagram edges
  const [tape, setTape] = useState(['_']);      // Initial tape with a blank
  const [head, setHead] = useState(0);          // Head starting position
  const [currentState, setCurrentState] = useState('q0'); // Current TM state

  return (
    <div className="visualiser">
      
      <div className="tape-container">
        <TapeContainer tape={tape} head={head} />
      </div>

      <div className="diagram-container">
        <DiagramContainer 
          nodes={nodes} 
          edges={edges} 
          setNodes={setNodes} 
          setEdges={setEdges} 
        />

      </div>

    </div>
  );
}
