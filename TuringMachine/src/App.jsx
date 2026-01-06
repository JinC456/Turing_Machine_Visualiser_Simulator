import React, { useState } from "react";
import Visualiser from "./Visualiser";
import "./App.css";

function App() {
  const [engine, setEngine] = useState("Deterministic");
  const [example, setExample] = useState("");

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
                onChange={(e) => setEngine(e.target.value)}
              >
                <option value="Deterministic">Deterministic</option>
                <option value="NonDeterministic">Non-Deterministic</option>
              </select>
            </div>

            <div className="selector-group">
              <label htmlFor="example-select">Examples:</label>
              <select
                id="example-select"
                value={example}
                onChange={(e) => setExample(e.target.value)}
              >
                <option value="">-- Select an Example --</option>
                <option value="palindrome">Palindrome Detector</option>
                <option value="binary_increment">Binary Increment</option>
                <option value="busy_beaver">Busy Beaver (3-state)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="header-right">
        </div>
      </div>

      <Visualiser engine={engine} selectedExample={example} />
    </div>
  );
}

export default App;