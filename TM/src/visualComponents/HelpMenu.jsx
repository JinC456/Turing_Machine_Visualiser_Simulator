/* src/simulatorComponents/HelpMenu.jsx */
import React, { useState } from "react";
import "../Visualiser.css";

export default function HelpMenu({ onClose }) {
  // ============================================
  // 1. DATA DEFINITION (Rich Content)
  // ============================================
  const helpData = [
    {
      category: "Turing Machines",
      id: "cat-tm",
      items: [
        {
          id: "dtm",
          title: "Deterministic Turing Machine (DTM)",
          hasVideo: false,
          content: (
            <>
              <p>
                A <strong>Deterministic Turing Machine (DTM)</strong> is the standard model of computation. 
                In a DTM, the set of rules prescribes exactly <em>one</em> action to be performed for any given situation.
                The machine consists of a finite control, an infinite tape, and a read/write head.
              </p>
              
              <div className="formal-def-box">
                <h4>Formal Definition</h4>
                <p>A DTM is a 7-tuple <strong>M = (Q, Γ, b, Σ, δ, q₀, F)</strong> where:</p>
                <ul>
                  <li><strong>Q</strong>: A finite non-empty set of states.</li>
                  <li><strong>Γ</strong>: A finite non-empty set of the tape alphabet symbols (includes Σ and the blank symbol ␣).</li>
                  <li><strong>b</strong>: The blank symbol ␣.</li>
                  <li><strong>Σ</strong>: The set of input symbols.</li>
                  <li><strong>δ</strong>: The Transition function (further explained below).</li>
                  <li><strong>q₀</strong>: The initial state.</li>
                  <li><strong>F</strong>: The set of final states or accepting states.</li>
                </ul>
                
                <h4>Transition Function (δ)</h4>
                <div className="math-block">
                  δ : Q × Γ → Q × Γ × {`{L, R}`}
                </div>
                <p>
                  This means: Given a current state (Q) and the symbol currently under the head (Γ), 
                  the machine moves to a new state (Q), writes a symbol (Γ), and moves the head Left (L) or Right (R).
                </p>
              </div>

              <p>
                <strong>In this simulator:</strong> If you define multiple transitions for the same symbol 
                the transition defined first will be the one simulated. To simulate multiple transitions for the same symbol switch engine mode to Non-Deterministic.
              </p>
            </>
          )
        },
        {
          id: "ntm",
          title: "Non-Deterministic Turing Machine (NTM)",
          hasVideo: false,
          content: (
            <>
              <p>
                A <strong>Non-Deterministic Turing Machine (NTM)</strong> allows for multiple possible moves 
                from the same configuration. 
              </p>

              <div className="formal-def-box">
                <h4>Formal Difference</h4>
                <p>
                  The definition is identical to a DTM, except for the <strong>transition function</strong>. 
                  Instead of returning a single next move, it returns a <em>set</em> of possible next moves.
                </p>

                <h4>Transition Function</h4>
                <div className="math-block">
                   δ : Q × Γ → 𝒫(Q × Γ × {`{L, R, N}`})
                </div>
                <p>
                  Where <strong>𝒫</strong> denotes the power set. This means for a given state and tape symbol, 
                  there can be zero, one, or multiple valid transitions.
                </p>
              </div>

              <p>
                <strong>In this simulator:</strong> When the machine encounters a non-deterministic choice, 
                it "branches." The visualiser creates a new thread for every possible path. 
                If <em>any</em> thread reaches the Accept state, the input is accepted.
              </p>
            </>
          )
        },
        {
          id: "multitape",
          title: "Multi-Tape Turing Machine",
          hasVideo: false,
          content: (
            <>
              <p>
                A <strong>Multi-Tape Turing Machine</strong> uses <em>k</em> independent tapes, each with its own read/write head. 
                The input is initially placed on the first tape, while the others are blank.
              </p>

              <div className="formal-def-box">
                <h4>Formal Definition</h4>
                <p>
                  The definition is identical to a DTM, except for the <strong>transition function</strong> which now depends on k tape symbols simultaneously. 
                </p>

                <h4>Transition Function</h4>
                <div className="math-block">
                  δ : Q × Γᵏ → Q × Γᵏ × {`{L, R, N}`}ᵏ
                </div>
                <p>
                  This means: Based on the current state and the <em>k</em> symbols read from the tapes, 
                  the machine transitions to a new state, writes <em>k</em> new symbols (one on each tape), 
                  and moves each head independently (Left, Right, or None).
                </p>
              </div>
              
              <p>
                <strong>Note:</strong> It has been proven that a Single-Tape machine can simulate a Multi-Tape machine, 
                but Multi-Tape machines are often more efficient. If you are interested in seeing how a single-tape machine can simulate a multitape machine
                check out the 'Simulate on single tape' button in Multi-Tape mode.
              </p>
            </>
          )
        }
      ]
    },
    {
    category: "Type of States",
    id: "cat-state-info",
    items: [
        {
        id: "state-info",
        title: "States",
        hasVideo: false,
        content: (
            <>
            <h4>Start State</h4>
            <p>
                The <strong>Start State</strong> is the initial state of the machine. 
                Computation always begins here, with the read/write head positioned 
                at the start of the input on the tape.
            </p>
            <p>
                Formally, this corresponds to <strong>q₀</strong> in the 7-tuple definition.
            </p>

            <img src="p" alt="Start State image" />

            <h4>Normal State</h4>
            <p>
                A <strong>Normal State</strong> represents an intermediate step in the computation. 
                The machine transitions between normal states as it reads symbols, 
                writes new symbols, and moves the tape head.
            </p>
            <p>
                These states belong to the set <strong>Q</strong>.
            </p>

            <img src="p" alt="Normal State image" />

            <h4>Accept State</h4>
            <p>
                An <strong>Accept State</strong> indicates that the input 
                has been accepted. When the machine enters this state, the computation halts 
                and the input is considered valid.
            </p>
            <p>
                Formally, accept states belong to the set <strong>F ⊆ Q</strong>.
            </p>

            <p>
                In this simulator, reaching an Accept State immediately stops execution.
                For Non-Deterministic machines, if <em>any</em> thread reaches 
                an Accept State, the input is accepted.
            </p>

            <img src="p" alt="Accept State image" />
            </>
        )
        }
    ]
    },
    {
      category: "Edit States",
      id: "cat-states-edit",
      items: [
        {
          id: "create-state",
          title: "Creating a State",
          hasVideo: true,
          content: (
            <>
              <p>To create a new state in the diagram drag any node from the left-hand toolbar and drop it onto the canvas.</p>
              <video src="v" controls width="100%" style={{ marginTop: '10px' }} />
            </>
          )
        },
        {
          id: "delete-state",
          title: "Deleting a State",
          hasVideo: true,
          content: (
             <>
               <p>
                 Click on a state to select it and press the <strong>Backspace</strong> key on your keyboard. 
                 <br/><br/>
                 <em>Warning:</em> This will also delete any transition edges connected to this state.
               </p>
               <video src="v" controls width="100%" style={{ marginTop: '10px' }} />
            </>
          )
        },
        {
          id: "rename-state",
          title: "Renaming a State",
          hasVideo: true,
          content: (
            <>
                <p>
                right-click the state you want to rename. A pop-up will appear. 
                Type your new name and press <strong>save changes</strong> to save.
                </p>
                <video src="v" controls width="100%" style={{ marginTop: '10px' }} />
            </>
          )
        },
        {
          id: "change-props",
          title: "Change from Normal to Accept State",
          hasVideo: true,
          content: (
            <>
              <p>double-click on a state to change it from a normal state to accept and vice versa</p>
              <video src="v" controls width="100%" style={{ marginTop: '10px' }} />
            </>
          )
        }
      ]
    },
    {
      category: "Transitions",
      id: "cat-edges",
      items: [
        {
          id: "create-edge",
          title: "Creating Transitions",
          hasVideo: true,
          content: (
            <>
              <p>
                Hover over the state too see the black dots surrounding the state, hover over the dot of your choice
                and your cursor will change. Click and drag the line to a target state. 
                To create a self-loop, drag the line back to a dot on the source state itself.
              </p>
              <video src="v" controls width="100%" style={{ marginTop: '10px' }} />
            </>
          )
        },
        {
          id: "edit-edge",
          title: "Editing Symbols",
          hasVideo: true,
          content: (
            <>
              <p>double-click on the line of the rule you want to edit .</p>
              <div className="formal-def-box">
                 <h4>Syntax Format</h4>
                 <p><strong>Read, Write, Direction</strong></p>
                 <p>Example: <code>a, b, R</code></p>
                 <ul>
                   <li><strong>Read:</strong> The symbol on the tape.</li>
                   <li><strong>Write:</strong> The symbol to overwrite with.</li>
                   <li><strong>Direction:</strong> L (Left), R (Right), or N (None).</li>
                 </ul>
              </div>
              <video src="v" controls width="100%" style={{ marginTop: '10px' }} />
            </>
          )
        }
      ]
    }
  ];

  // ============================================
  // 2. STATE MANAGEMENT
  // ============================================
  const [openCategoryId, setOpenCategoryId] = useState("cat-tm"); 
  const [activeItemId, setActiveItemId] = useState("dtm");

  const getCurrentItem = () => {
    for (const cat of helpData) {
      const found = cat.items.find((i) => i.id === activeItemId);
      if (found) return found;
    }
    return null;
  };

  const currentItem = getCurrentItem();
  const allItems = helpData.flatMap((cat) => cat.items);
  const currentIndex = allItems.findIndex((i) => i.id === activeItemId);

  const handleNext = () => {
    if (currentIndex < allItems.length - 1) {
      const nextItem = allItems[currentIndex + 1];
      setActiveItemId(nextItem.id);
      const parentCat = helpData.find(cat => cat.items.some(i => i.id === nextItem.id));
      if (parentCat) setOpenCategoryId(parentCat.id);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      const prevItem = allItems[currentIndex - 1];
      setActiveItemId(prevItem.id);
      const parentCat = helpData.find(cat => cat.items.some(i => i.id === prevItem.id));
      if (parentCat) setOpenCategoryId(parentCat.id);
    }
  };

  // ============================================
  // 3. RENDER
  // ============================================
  return (
    <div className="popup-overlay" onClick={onClose} style={{ zIndex: 3000 }}>
      <div className="help-modal-container" onClick={(e) => e.stopPropagation()}>
        
        {/* HEADER */}
        <div className="help-modal-header">
          <h3>Help Guide</h3>
          <button className="help-close-btn" onClick={onClose}>&times;</button>
        </div>

        {/* BODY */}
        <div className="help-modal-body">
          
          {/* LEFT SIDEBAR */}
          <div className="help-sidebar">
            {helpData.map((cat) => {
              const isOpen = openCategoryId === cat.id;
              return (
                <div key={cat.id} className="help-category-group">
                  <div 
                    className={`help-category-header ${isOpen ? 'active' : ''}`}
                    onClick={() => setOpenCategoryId(isOpen ? null : cat.id)}
                  >
                    <span>{cat.category}</span>
                    <span>{isOpen ? '▼' : '▶'}</span>
                  </div>

                  {isOpen && (
                    <div className="help-subitems">
                      {cat.items.map((item) => (
                        <div
                          key={item.id}
                          className={`help-item-row ${activeItemId === item.id ? 'selected' : ''}`}
                          onClick={() => setActiveItemId(item.id)}
                        >
                          <span className="bullet">▸</span>
                          {item.title.includes("(") ? item.title.split("(")[0] : item.title}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* RIGHT CONTENT */}
          <div className="help-content">
            {currentItem && (
              <>
                <h2 className="help-title">{currentItem.title}</h2>
                
                {/* RENDER JSX CONTENT */}
                <div className="help-text-body">
                  {currentItem.content}
                </div>
                
              </>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="help-modal-footer">
          <button 
            className="nav-btn" 
            onClick={handlePrev} 
            disabled={currentIndex === 0}
          >
            &larr; Previous
          </button>
          <span className="page-count">
            {currentIndex + 1} / {allItems.length}
          </span>
          <button 
            className="nav-btn" 
            onClick={handleNext}
            disabled={currentIndex === allItems.length - 1}
          >
            Next &rarr;
          </button>
        </div>

      </div>
    </div>
  );
}