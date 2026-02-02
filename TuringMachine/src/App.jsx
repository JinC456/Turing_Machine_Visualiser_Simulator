import React, { useState, useEffect } from "react";
import Visualiser from "./Visualiser";
import "./App.css";

const EXAMPLES = {
  Deterministic: [
    { value: "palindrome", label: "Palindrome Detector" },
    { value: "binary_increment", label: "Binary Increment" },
    { value: "busy_beaver", label: "Busy Beaver (3-state)" },
  ],
  MultiTape: [
    { value: "palindrome_multi", label: "Palindrome (2-Tape)" },
    { value: "is_equal_multi", label: "Is Equal (2-Tape)" },
    { value: "binary_addition", label: "Binary Addition (3-Tape)" },
  ],
  NonDeterministic: [
    { value: "palindrome", label: "Palindrome (NTM)" },
    { value: "binary_increment", label: "Binary Increment (NTM)" },
    { value: "Find_hash", label: "Find hash (DTM)" },
    { value: "is_equal_NTM", label: "Is Equal (DTM)" }
  ],
};

function App() {
  const [engine, setEngine] = useState("Deterministic");
  const [example, setExample] = useState("");
  const [showTable, setShowTable] = useState(false);

  // Reset example when engine changes to avoid invalid states
  useEffect(() => {
    setExample("");
  }, [engine]);

  const handleEngineChange = (e) => {
    setEngine(e.target.value);
  };

  const currentExamples = EXAMPLES[engine] || [];

  return (
    <div className="app">
      <div className="app-header">
        <div className="header-left">
          <h1>Turing Machine Simulator</h1>
          
          <div className="header-controls">
            <div className="selector-group">
              <label htmlFor="engine-select">Engine:</label>
              <select
                id="engine-select"
                value={engine}
                onChange={handleEngineChange}
              >
                <option value="Deterministic">Deterministic</option>
                <option value="NonDeterministic">Non-Deterministic</option>
                <option value="MultiTape">Multi-Tape</option>
              </select>
            </div>

            <div className="selector-group">
              <label htmlFor="example-select">Examples:</label>
              <select
                id="example-select"
                value={example}
                onChange={(e) => setExample(e.target.value)}
                disabled={currentExamples.length === 0}
              >
                <option value="">-- Select an Example --</option>
                {currentExamples.map((ex) => (
                  <option key={ex.value} value={ex.value}>
                    {ex.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="header-right">
          <button 
            className="header-button" 
            onClick={() => setShowTable(true)}
          >
            Transition Table
          </button>
        </div>
      </div>

      <Visualiser 
        engine={engine} 
        selectedExample={example} 
        showTable={showTable} 
        setShowTable={setShowTable} 
      />
    </div>
  );
}

export default App;