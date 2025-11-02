import React, { useState } from 'react';
import { ReactFlowProvider } from 'reactflow';
import TapeContainer from './components/TapeContainer';
import DiagramContainer from './components/DiagramContainer';
import './Visualiser.css';

export default function Visualiser() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [tape, setTape] = useState(['_']);
  const [head, setHead] = useState(0);

  return (
    <ReactFlowProvider>
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
    </ReactFlowProvider>
  );
}
