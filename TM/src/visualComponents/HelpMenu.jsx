import React, { useState } from "react";
import "../Visualiser.css";

export default function HelpMenu({ onClose }) {

  const helpData = [
    {
      category: "Basics",
      id: "cat-basics",
      items: [
        {
          id: "what-is-tm",
          title: "What is a Turing Machine?",
          hasVideo: false,
          content: (
            <>
              <p>
                A <strong>Turing Machine</strong> is a mathematical model of computation invented by Alan Turing in 1936. 
                It is simple in design but powerful enough to simulate any algorithm that a modern computer can run.
              </p>
              <p>
                Despite its simplicity, it forms the theoretical foundation for what it means for a problem to be computable. 
                If a problem cannot be solved by a Turing Machine, it cannot be solved by any computer.
              </p>

              <div className="formal-def-box">
                <h4>The Components</h4>
                <ul>
                  <li><strong>Tape</strong>: an infinite strip of cells, each holding one symbol. Initially the input is written on the tape and the rest is blank.</li>
                  <li><strong>Read/Write Head</strong>: positioned over one cell at a time. It can read the symbol in that cell, write a new symbol, and then move one step left or right.</li>
                  <li><strong>States</strong>: the machine is always in one state at a time. The current state, combined with the symbol being read, determines what the machine does next.</li>
                  <li><strong>Transition Rules</strong>: a table of instructions of the form: given this state and this symbol, write this symbol, move the head left or right, and go to this next state.</li>
                </ul>

                <h4>How it Runs</h4>
                <p>
                  The machine starts in the <strong>Start State</strong> with the head at the beginning of the input. 
                  At each step it reads the symbol under the head, looks up the matching transition rule, writes a symbol, moves the head, and changes state. 
                  This continues until the machine enters an <strong>Accept State</strong> (input accepted), a <strong>Reject State</strong> (input rejected), or loops forever.
                </p>
              </div>
            </>
          )
        },
        {
          id: "basics-states",
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

              <div style={{ textAlign: 'center', margin: '10px 0' }}>
                <img src="src/Pictures and Videos/start.png" alt="Start State image" />
              </div>

              <h4>Normal State</h4>
              <p>
                A <strong>Normal State</strong> represents an intermediate step in the computation. 
                The machine transitions between normal states as it reads symbols, 
                writes new symbols, and moves the tape head.
                These states belong to the set <strong>Q</strong>.
              </p>

              <div style={{ textAlign: 'center', margin: '10px 0' }}>
                <img src="src/Pictures and Videos/state.png" alt="Normal State image" />
              </div>

              <h4>Accept State</h4>
              <p>
                An <strong>Accept State</strong> indicates that the input has been accepted. When the machine enters this state, the computation halts and the input is considered valid.
                Formally, accept states belong to the set <strong>F ⊆ Q</strong>.
              </p>
              <p>
                In this simulator, reaching an Accept State immediately stops execution.
                For Non-Deterministic machines, if <em>any</em> thread reaches 
                an Accept State, the input is accepted.
              </p>

              <div style={{ textAlign: 'center', margin: '10px 0' }}>
                <img src="src/Pictures and Videos/accept.png" alt="Accept State image" />
              </div>
            </>
          )
        }
      ]
    },
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
                In a DTM, the set of rules describes exactly <em>one</em> action to be performed for any given situation.
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
              <video src="src/Pictures and Videos/DragNode.mp4" controls width="100%" style={{ marginTop: '10px' }} />
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
                Right-click the state you want to rename. A pop-up will appear. 
                Type your new name and press <strong>Save Changes</strong> to confirm.
                </p>
                <video src="src/Pictures and Videos/ReNameNode.mp4" controls width="100%" style={{ marginTop: '10px' }} />
            </>
          )
        },
        {
          id: "change-props",
          title: "Change from Normal to Accept State",
          hasVideo: true,
          content: (
            <>
              <p>Double-click on a state to toggle it between a Normal state and an Accept state.</p>
              <video src="src/Pictures and Videos/acceptToggle.mp4" controls width="100%" style={{ marginTop: '10px' }} />
            </>
          )
        }
      ]
    },
    {
      category: "Edit Transitions",
      id: "cat-edges",
      items: [
        {
          id: "create-edge",
          title: "Creating Transitions",
          hasVideo: true,
          content: (
            <>
              <p>
                Hover over a state to see the black dots around it, then hover over the dot of your choice and your cursor will change. Click and drag to a target state to create a transition. To create a self-loop, drag the line back to a dot on the source state itself.
              </p>
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
              <video src="src/Pictures and Videos/addTransition.mp4" controls width="100%" style={{ marginTop: '10px' }} />
            </>
          )
        },
        {
          id: "edit-edge",
          title: "Editing Transitions",
          hasVideo: true,
          content: (
            <>
              <p>Double-click on the line of the transition you want to edit.</p>
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
              <video src="src/Pictures and Videos/editRule.mp4" controls width="100%" style={{ marginTop: '10px' }} />
            </>
          )
        },
        
      ]
    },
    {
      category: "Diagram Editor",
      id: "general-edit",
      items: [
        {
          id: "selection",
          title: "Selection Tool",
          hasVideo: true,
          content: (
            <>
              <p>
                Press and hold <strong>Shift</strong> while dragging your mouse to draw a selection box.
                This lets you select multiple states and edges at once.
                Once selected, you can move them as a group or delete them together.
              </p>
              <video src="src/Pictures and Videos/Select.mp4" controls width="100%" style={{ marginTop: '10px' }} />
            </>
          )
        },
        {
          id: "zoom",
          title: "Zooming and Panning",
          hasVideo: true,
          content: (
            <>
              <p>
                Use the <strong>+</strong> and <strong>−</strong> buttons on the toolbar to zoom in and out, or scroll the mouse wheel while the cursor is inside the editor.
              </p>
              <video src="src/Pictures and Videos/Zoom.mp4" controls width="100%" style={{ marginTop: '10px' }} />
            </>
          )
        },
        {
          id: "delete",
          title: "Deleting Items",
          hasVideo: true,
          content: (
            <>
              <p>
                Select any item (a state, a transition edge, or a group of items) and press <strong>Backspace</strong> or <strong>Delete</strong> to remove them. 
                <br/><br/>
                <em>Note:</em> Deleting a state will also delete all transition edges connected to it.
              </p>
              <video src="src/Pictures and Videos/deleteItems.mp4" controls width="100%" style={{ marginTop: '10px' }} />
            </>
          )
        },
        {
          id: "import-export",
          title: "Importing and Exporting Diagrams",
          hasVideo: true,
          content: (
            <>
              <p>
                Click the <strong>Export</strong> button, enter a name for the diagram, and press OK. This downloads a <code>.json</code> file containing all the information about your diagram.
                <br/><br/>
                Click the <strong>Import</strong> button to open a file picker and select a previously exported <code>.json</code> file. The diagram will be loaded directly into the visualiser.
              </p>
              <video src="src/Pictures and Videos/ImportExport.mp4" controls width="100%" style={{ marginTop: '10px' }} />
            </>
          )
        },

        {
          id: "notes",
          title: "Adding Notes",
          hasVideo: true,
          content: (
            <>
              <p>
                Click the note button on the toolbar to create a new note on the canvas. Notes are free-form text boxes you can use to jot down thoughts, explain what the machine does, or describe how it works for anyone viewing the diagram. Notes are saved with the diagram when exported.
              </p>
              <video src="src/Pictures and Videos/Notes.mp4" controls width="100%" style={{ marginTop: '10px' }} />
            </>
          )
        },

         {
          id: "clear-btn",
          title: "Clear All button",
          hasVideo: true,
          content: (
            <>
              <p>
                The Clear All button on the toolbar allows you to quickly reset the canvas by deleting all states, transitions, and notes. This is useful when you want to start fresh without having to manually delete each item.
              </p>
              <video src="src/Pictures and Videos/ClearAll.mp4" controls width="100%" style={{ marginTop: '10px' }} />
            </>
          )
        },
        
      ]
    },
    {
      category: "Tape Simulation",
      id: "cat-tape-sim",
      items: [
        {
          id: "tape-controls",
          title: "Simulation Controls",
          hasVideo: false,
          content: (
            <>
              <p>
                The simulation controls sit at the bottom of the tape. Enter your input string into the input box on the left, then use the buttons to run and step through the machine.
              </p>

              <img src="src/Pictures and Videos/TapeControls.png" alt="Tape simulation controls" style={{ width: '100%', marginTop: '10px', marginBottom: '14px', borderRadius: '6px' }} />

              <div className="formal-def-box">
                <h4>Input</h4>
                <p>Type the string you want the machine to process into the input box. This will show on the Tape.</p>

                <h4>Start</h4>
                <p>begins the simulation from the head position.</p>

                <h4>Stop</h4>
                <p>Pauses the simulation at the current step. You can resume using the play button or step through manually.</p>

                <h4>Step Back ( &lt; )</h4>
                <p>Moves the simulation back one step, restoring the tape and state to what they were at the previous step.</p>

                <h4>Step Forward ( &gt; )</h4>
                <p>Advances the simulation one step at a time. Useful for following the machine's logic closely.</p>

                <h4>Skip to Start ( &gt;&gt;)</h4>
                <p>Jumps back to the very beginning of the simulation, resetting the tape to the original input.</p>

                <h4>Skip to End ( &lt;&lt; )</h4>
                <p>Runs the simulation all the way to its final result in one go, without animating each step.</p>

                <h4>Clear</h4>
                <p>Clears the tape and resets the simulation. The input box is also cleared.</p>

                <h4>Speed</h4>
                <p>The speed slider controls how fast the simulation runs when playing continuously. Drag it right to increase the speed.</p>
              </div>
            </>
          )
        },
        {
          id: "tape-rejected-badge",
          title: "Rejected Badge",
          hasVideo: true,
          content: (
            <>
              <p>
                When the machine rejects an input, the tape panel displays a <strong>Rejected</strong> badge. Clicking this badge opens a message explaining why the machine rejected the input.
              </p>
              <p>
                This is useful for debugging your machine. For example, it will tell you if the machine rejected because there was no valid transition for the current symbol and state, or because it timed out.
              </p>
              <video src="src/Pictures and Videos/RejectBadge.mp4" controls width="100%" style={{ marginTop: '10px' }} />
            </>
          )
        }
      ]
    },
    {
      category: "Transition Table and Alphabet",
      id: "cat-transition-table",
      items: [
        {
          id: "tt-dtm",
          title: "Deterministic",
          hasVideo: false,
          content: (
            <>
              <p>
                The <strong>Transition Table</strong> gives an overview of every rule defined in your machine.
                It is an alternative way to view and understand the transitions on your diagram.
              </p>

              <div className="formal-def-box">
                <h4>Table Structure</h4>
                <p>
                  The table is organised as a matrix where:
                </p>
                <ul>
                  <li><strong>Rows (Q)</strong>: represent each state in the machine.</li>
                  <li><strong>Columns (Σ)</strong>: represent each symbol in the alphabet. This includes the symbols added via the <strong>Alphabet (Σ)</strong> input at the top of the table, plus the blank symbol <code>␣</code>.</li>
                </ul>
                <h4>How to Read a Cell</h4>
                <p>Each cell shows the result of applying the transition function δ for that state and symbol:</p>
                <div className="math-block">Write, Direction, Next State</div>
                <p>
                  For example, a cell containing <code>␣, R, S2</code> means: write the blank symbol, move the head Right, and transition to state S2.
                  A <code>/</code> means no transition is defined for that combination.
                </p>
              </div>

              <img src="src/Pictures and Videos/TableDTM.png" alt="DTM transition table" style={{ width: '100%', marginTop: '10px', borderRadius: '6px' }} />
            </>
          )
        },
        {
          id: "tt-ntm",
          title: "Non-Deterministic",
          hasVideo: false,
          content: (
            <>
              <p>
                The NTM transition table follows the same structure as the DTM table, but a single cell can contain <strong>multiple rules</strong> — one for each possible non-deterministic branch.
              </p>

              <div className="formal-def-box">
                <h4>Multiple Rules per Cell</h4>
                <p>
                  When more than one transition is defined for the same state and symbol, each rule is listed in the cell and separated by a <strong>pipe ( | )</strong>.
                </p>
                <div className="math-block">Write₁, Dir₁, State₁ | Write₂, Dir₂, State₂</div>
                <p>
                  For example, <code>0, L, S1 | 0, R, S2</code> means the machine can branch: one thread moves left to S1, another moves right to S2.
                </p>
                <h4>Alphabet</h4>
                <p>
                  As with the DTM table, the <strong>column headers are the alphabet symbols (Σ)</strong> you have defined, plus the blank <code>␣</code>.
                </p>
              </div>

              <img src="src/Pictures and Videos/TableNTM.png" alt="NTM transition table" style={{ width: '100%', marginTop: '10px', borderRadius: '6px' }} />
            </>
          )
        },
        {
          id: "tt-multitape",
          title: "Multi-Tape",
          hasVideo: false,
          content: (
            <>
              <p>
                The Multi-Tape transition table is more complex because each transition depends on symbols read from <em>multiple tapes simultaneously</em>.
              </p>

              <div className="formal-def-box">
                <h4>Column Headers</h4>
                <p>
                  Unlike the DTM and NTM tables, the columns do <strong>not</strong> list every possible symbol. Instead, each column represents a <strong>combination of symbols actually read across tapes</strong> - only combinations that appear in your diagram are shown.
                  A colon ( <strong>:</strong> ) separates the tape values within each column header.
                </p>
                <div className="math-block">Tape1Symbol : Tape2Symbol</div>
                <p>For example, a column headed <code>a : ␣</code> means tape 1 reads <code>a</code> and tape 2 reads <code>␣</code>.</p>

                <h4>How to Read a Cell</h4>
                <p>
                  Each cell shows the writes, directions, and next state for that combination. The colon again separates per-tape values:
                </p>
                <div className="math-block">(Write₁, Dir₁ : Write₂, Dir₂) → Next State</div>

                <h4>Alphabet</h4>
                <p>
                  The alphabet is shown as <strong>Σ above the table</strong> as a set of labelled chips. This is the input alphabet shared across all tapes.
                </p>
              </div>

              <img src="src/Pictures and Videos/TableMultiMatrix.png" alt="Multi-tape transition table matrix view" style={{ width: '100%', marginTop: '10px', borderRadius: '6px' }} />

              <div className="formal-def-box" style={{ marginTop: '14px' }}>
                <h4>List View</h4>
                <p>
                  You can switch to <strong>List View</strong> using the button in the top-right of the table. This shows each transition as a flat row with columns for Start State, Read, Write, Direction, and Next State. This is useful when the matrix becomes wide with many tape combinations.
                  The colon separator is used here too, listing the per-tape values for Read, Write, and Direction within each row.
                </p>
              </div>

              <img src="src/Pictures and Videos/TableMultiList.png" alt="Multi-tape transition table list view" style={{ width: '100%', marginTop: '10px', borderRadius: '6px' }} />
            </>
          )
        },
        {
          id: "tt-alphabet",
          title: "The Alphabet (Σ)",
          hasVideo: true,
          content: (
            <>
              <p>
                The alphabet <strong>Σ</strong> defines the set of symbols the tape will accept as valid input. 
                The machine will only process symbols that are part of the alphabet - any symbol not in Σ cannot appear on the tape.
              </p>

              <div className="formal-def-box">
                <h4>Derived Symbols <span style={{ color: '#4a90d9' }}>(Blue)</span></h4>
                <p>
                  <strong style={{ color: '#4a90d9' }}>Derived symbols</strong> are symbols that have been automatically detected from the transitions already drawn on your diagram. 
                  They appear as <strong style={{ color: '#4a90d9' }}>blue </strong> in the alphabet. You do not need to add these manually - the table keeps them in sync with your diagram.
                </p>

                <h4>Added Symbols <span style={{ color: '#c0392b' }}>(Red)</span></h4>
                <p>
                  <strong style={{ color: '#c0392b' }}>Added symbols</strong> are symbols you have manually added via the alphabet input at the top of the table. 
                  They appear as <strong style={{ color: '#c0392b' }}>red</strong>. Use these when you want to allow a symbol as a valid input even if it does not yet appear in any transition on the diagram.
                </p>

                <h4>Adding a Symbol</h4>
                <p>
                  Type the symbol into the <strong>Add char…</strong> input at the top of the Transition Table and press <strong>Add</strong> (or Enter). The new symbol will appear in red and a new column will be added to the table.
                </p>
              </div>

              <p><strong>In NTM mode</strong> — the alphabet appears as column headers in the transition table:</p>
              <video src="src/Pictures and Videos/AddAlphaGen.mp4" controls width="100%" style={{ marginTop: '8px' }} />

              <p style={{ marginTop: '14px' }}><strong>In Multi-Tape mode</strong> — the alphabet appears as Σ pills above the table:</p>
              <video src="src/Pictures and Videos/AddAlphaMulti.mp4" controls width="100%" style={{ marginTop: '8px' }} />
            </>
          )
        },
        {
          id: "tt-delete-symbol",
          title: "Deleting Alphabet Symbols",
          hasVideo: true,
          content: (
            <>
              <p>
                You can remove a symbol from the alphabet by clicking the <strong>✕</strong> next to it. 
                The behaviour depends on whether the symbol is added (red) or derived (blue).
              </p>

              <div className="formal-def-box">
                <h4>Deleting an Added Symbol <span style={{ color: '#c0392b' }}>(Red)</span></h4>
                <p>
                  If you delete a <strong style={{ color: '#c0392b' }}>red (added) symbol</strong>, it is simply removed from the alphabet. 
                  It will no longer be accepted as a valid input. No changes are made to the diagram since the symbol was never used in any transition.
                </p>

                <h4>Deleting a Derived Symbol <span style={{ color: '#4a90d9' }}>(Blue)</span></h4>
                <p>
                  If you attempt to delete a <strong style={{ color: '#4a90d9' }}>blue (derived) symbol</strong>, a prompt will appear with two options:
                </p>
                <ul>
                  <li><strong>Delete all</strong> — removes every transition in the diagram that references this symbol.</li>
                  <li><strong>Replace</strong> — substitutes the symbol with another symbol of your choice across all transitions in the diagram.</li>
                </ul>
              </div>

              <video src="src/Pictures and Videos/DeleteAlpha.mp4" controls width="100%" style={{ marginTop: '10px' }} />
            </>
          )
        },
        {
          id: "tt-float",
          title: "Float Window",
          hasVideo: false,
          content: (
            <>
              <p>
                By default, the Transition Table opens as a large modal that covers part of the diagram. 
                Clicking the <strong>Float Window</strong> button in the top-right of the table collapses it into a floating panel.
              </p>
              <p>
                The floating panel can be <strong>dragged anywhere</strong> on the screen, allowing you to view the transition table and the diagram side by side at the same time. 
                This is especially useful when verifying that your diagram matches the transitions you expect, or when building a machine step by step.
              </p>
              <p>
                To return to the full table view, simply click the <strong>Modal View</strong> button.
              </p>
            </>
          )
        }
      ]
    },
    {
      category: "NTM Simulation",
      id: "cat-ntm-sim",
      items: [
        {
          id: "ntm-threads",
          title: "How Threads Work",
          hasVideo: true,
          content: (
            <>
              <p>
                When a Non-Deterministic Turing Machine encounters a state where <strong>more than one transition</strong> is valid for the current symbol, 
                the simulator does not pick one, it <strong>splits</strong> into multiple independent threads, one for each possible transition.
                Each thread then continues running on its own copy of the tape from that point forward.
              </p>

              <div className="formal-def-box">
                <h4>Thread Naming</h4>
                <p>
                  Threads are named to reflect the history of splits that created them:
                </p>
                <ul>
                  <li>The first thread is <strong>Thread 1</strong>.</li>
                  <li>When Thread 1 splits, its children become <strong>Thread 1.1</strong>, <strong>Thread 1.2</strong>, and so on.</li>
                  <li>If Thread 1.1 splits again, its children become <strong>Thread 1.1.1</strong>, <strong>Thread 1.1.2</strong>, etc.</li>
                </ul>
                <p>Each level of the name represents one layer of branching deeper into the computation tree.</p>

                <h4>Thread Colours</h4>
                <p>
                  Every thread is assigned a unique colour, shown as a coloured square next to its name in the tape panel. 
                  This colour is used consistently across the tape view and the diagram to identify that thread's activity.
                </p>

                <h4>Status Badges</h4>
                <p>Each thread displays a status badge showing its current state:</p>
                <ul>
                  <li><strong>Running</strong>: the thread is still active and processing.</li>
                  <li><strong>Split</strong>: this thread has branched; see the Frozen &amp; Rejected section for more detail.</li>
                  <li><strong>Accepted</strong>: the thread has reached an Accept state. The input is accepted.</li>
                  <li><strong>Rejected</strong>: the thread has halted without accepting.</li>
                </ul>
                <p>
                  If <em>any</em> thread reaches the Accepted state, the entire input is considered accepted — 
                  the other threads do not need to accept.
                </p>
              </div>

              <video src="src/Pictures and Videos/NTMsim.mp4" controls width="100%" style={{ marginTop: '10px' }} />
            </>
          )
        },
        {
          id: "ntm-visualisation",
          title: "Reading the Visualisation",
          hasVideo: false,
          content: (
            <>
              <p>
                While the machine is running, the diagram highlights the active nodes and edges for each thread using that thread's colour. 
                This lets you visually track multiple threads simultaneously on the same diagram.
              </p>

              <div className="formal-def-box">
                <h4>Nodes</h4>
                <p>
                  When a thread is currently in a state, the corresponding node is outlined in that thread's colour. 
                  If <strong>multiple threads are in the same state</strong> at the same time, the node will show 
                  multiple concentric coloured rings — one per thread.
                </p>

                <h4>Edges</h4>
                <p>
                  The transition edge being traversed by a thread is highlighted in that thread's colour. 
                  If multiple threads are crossing the same edge simultaneously, the edge will display 
                  layered colours, one for each active thread.
                </p>

                <h4>Rule Dots</h4>
                <p>
                  Each transition rule on the diagram shows a small coloured dot indicating which thread is currently reading that rule. 
                  If multiple threads are reading the same rule at the same step, multiple dots will appear — one per thread, each in its respective colour.
                </p>
              </div>

               <img src="src/Pictures and Videos/NTMnodeEdgeRule.png" alt="NTM diagram with multiple thread colours on node, edge and rule." style={{ width: '100%', marginTop: '10px', borderRadius: '6px' }} />

              
            </>
          )
        },
        {
          id: "ntm-frozen-rejected",
          title: "Frozen & Rejected Threads",
          hasVideo: true,
          content: (
            <>
              <p>
                Depending on the machine and input, an NTM simulation can produce a large number of threads very quickly. 
                To keep the view manageable, <strong>only active (Running) threads are shown by default</strong>.
              </p>

              <div className="formal-def-box">
                <h4>Frozen Threads (History)</h4>
                <p>
                  When a thread <strong>splits</strong>, the original thread is frozen at the point of branching — 
                  it is preserved as a historical record of where the split occurred. 
                  Frozen threads are hidden by default but can be revealed by enabling the <strong>Show History (Frozen)</strong> toggle above the tape panel.
                </p>

                <h4>Rejected Threads</h4>
                <p>
                  A thread becomes <strong>Rejected</strong> when it reaches a state with no valid transition for the current symbol, 
                  or exhausts all paths without reaching an Accept state. 
                  Rejected threads are also hidden by default and can be shown using the <strong>Show Rejected</strong> toggle.
                </p>

                <h4>The Toggles</h4>
                <p>
                  Both toggles sit above the tape panel:
                </p>
                <ul>
                  <li><strong>Show History (Frozen)</strong>: reveals threads that have been frozen at a split point, so you can see the full branching history of the computation.</li>
                  <li><strong>Show Rejected</strong>: reveals threads that have been rejected, useful for debugging why certain paths failed.</li>
                </ul>

              </div>

              <video src="src/Pictures and Videos/NTMtoggle.mp4" controls width="100%" style={{ marginTop: '10px' }} />
            </>
          )
        }
      ]
    },
    {
      category: "Multi-Tape Simulation",
      id: "cat-multitape-sim",
      items: [
        {
          id: "mt-adding-tapes",
          title: "Adding Tapes",
          hasVideo: false,
          content: (
            <>
              <p>
                Multi-Tape mode starts with <strong>2 tapes</strong> by default. To add more tapes, click on any existing transition rule on the diagram and press <strong>Add Tape</strong>. A new tape will appear in the editor and you can begin entering rules for it alongside the existing ones.
              </p>
              <p>
                Each tape has its own independent read/write head. Rules are defined per-tape within each transition, so adding a tape means every transition needs a corresponding rule for the new tape.
              </p>

              <video src="src/Pictures and Videos/addTape.mp4" controls width="100%" style={{ marginTop: '10px' }} />
            </>
          )
        },
        {
          id: "mt-sipser",
          title: "How Multi-Tape to Single-Tape Conversion Works",
          hasVideo: false,
          content: (
            <>
              <p>
                The simulator runs the Multi-Tape machine using a single-tape encoding based on <strong>Sipser's construction</strong> from the proof that every Multi-Tape Turing Machine can be simulated by a single-tape machine.
              </p>

              <div className="formal-def-box">
                <h4>Zone Encoding</h4>
                <p>
                  The contents of all <em>k</em> tapes are encoded onto one tape by concatenating them and separating each tape's zone with a <strong>delimiter symbol ( | )</strong>. The tape looks like:
                </p>
                <div className="math-block">Zone₁ | Zone₂ | ... | Zoneₖ</div>
                <img src="src/Pictures and Videos/ConversionTape.png" alt="Tape zones separated by pipe delimiters" style={{ width: '100%', marginTop: '10px', marginBottom: '10px', borderRadius: '6px' }} />
                <p>
                  Within each zone, the position of that tape's virtual read/write head is tracked by marking the symbol under it with a <strong>caret ( ^ )</strong>. Unmarked cells hold the tape contents as normal.
                </p>

                <h4>Step-by-Step Simulation</h4>
                <p>Each simulated step of the Multi-Tape machine requires the single-tape machine to perform the following passes:</p>
                <ul>
                  <li><strong>Pass 1 — Scan for heads:</strong> The head sweeps right across the entire tape, reading the marked symbol ( ^ ) in each zone to find out what each virtual tape is currently reading.</li>
                  <li><strong>Pass 2 — Rewind:</strong> The head moves back to the leftmost position of the tape, ready to begin the update pass.</li>
                  <li><strong>Pass 3 — Update:</strong> The head sweeps right again through each zone. For each zone it finds the marked symbol and applies the corresponding rule: it writes the new symbol, then shifts the caret left, right, or leaves it in place (None) depending on the direction specified by the transition.</li>
                </ul>
                <p>This three-pass process repeats for every step until an Accept or Reject state is reached.</p>

                <h4>Tape Expansion</h4>
                <p>
                  Because all zones share a single tape, the zones are fixed in length until a virtual head needs to write a symbol where a <strong>zone delimiter ( | ) currently sits</strong> — meaning the zone needs to grow. When this happens, the machine must first <strong>shift every symbol to the right of that point one cell further right</strong> to make room for the new symbol. Only then can it write the new content and continue. This shifting is what makes the single-tape simulation significantly slower than the original Multi-Tape machine.
                </p>
              </div>
            </>
          )
        },
        {
          id: "mt-single-tape-btn",
          title: "Convert to Single Tape",
          hasVideo: true,
          content: (
            <>
              <p>
                The <strong>Single Tape</strong> button applies Sipser's construction to your current Multi-Tape diagram and generates an equivalent single-tape Turing Machine. The result opens as a new diagram you can inspect and simulate.
              </p>

              <div className="formal-def-box">
                <h4>State Explosion</h4>
                <p>
                  Because the single-tape simulation must encode all tape zones and head positions into one machine, the number of states grows significantly compared to the original. This is known as <strong>state explosion</strong>. For machines with many tapes or a large alphabet, the generated diagram can be very large and may take a moment to fully render.
                </p>

                <h4>Auto-Pan</h4>
                <p>
                  Because the generated diagram is often too large to view all at once, the visualiser will <strong>automatically pan to the currently active node</strong> during simulation so you can always follow the machine's progress without manually navigating the graph.
                </p>
              </div>

              <video src="src/Pictures and Videos/ConvertSim.mp4" controls width="100%" style={{ marginTop: '10px' }} />
            </>
          )
        }
      ]
    }
    
  ];

  const [openCategoryId, setOpenCategoryId] = useState("cat-basics"); 
  const [activeItemId, setActiveItemId] = useState("what-is-tm");

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