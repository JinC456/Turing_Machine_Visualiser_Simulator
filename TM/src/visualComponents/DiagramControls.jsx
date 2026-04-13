import React, { useRef, useState, useEffect, useCallback } from "react";

export default function DiagramControls({ 
  onClearAll, 
  onUndo, 
  onRedo, 
  onExport,
  onImport,
  canUndo,
  canRedo,
  isLocked,
  engine,
  onConvert,
  note,
  onNoteChange,
}) {
  const fileInputRef = useRef(null);
  const editorRef = useRef(null);
  const [showNote, setShowNote] = useState(false);
  const [position, setPosition] = useState({ x: 80, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const [size, setSize] = useState({ width: 340, height: 300 });
  const [isResizing, setIsResizing] = useState(false);
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });

  const [hasClickedNotes, setHasClickedNotes] = useState(false);

  const onHeaderMouseDown = (e) => {
    setIsDragging(true);
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    e.preventDefault();
  };

  const onResizeMouseDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    resizeStart.current = { x: e.clientX, y: e.clientY, width: size.width, height: size.height };
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        setPosition({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
      }
      if (isResizing) {
        const dx = e.clientX - resizeStart.current.x;
        const dy = e.clientY - resizeStart.current.y;
        setSize({
          width: Math.max(260, resizeStart.current.width + dx),
          height: Math.max(200, resizeStart.current.height + dy),
        });
      }
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };
    if (isDragging || isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isResizing]);

  const [activeFormats, setActiveFormats] = useState({ bold: false, italic: false, ul: false });

  const onImportClick = () => {
    if (!isLocked) fileInputRef.current?.click();
  };

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        onImport(json);
      } catch (err) {
        alert("Failed to load file. Please ensure it is a valid JSON file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (el.innerHTML !== note) {
      el.innerHTML = note || "";
    }
  }, [note, showNote]);

  const handleInput = useCallback(() => {
    const el = editorRef.current;
    if (el) onNoteChange(el.innerHTML);
  }, [onNoteChange]);

  const updateActiveFormats = useCallback(() => {
    setActiveFormats({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      ul: document.queryCommandState("insertUnorderedList"),
    });
  }, []);

  const execFormat = (command) => {
    editorRef.current?.focus();
    document.execCommand(command, false, null);
    handleInput();
    updateActiveFormats();
  };

  // Check if there is actual text in the note, ignoring empty HTML tags
  const hasContent = note && note.replace(/<[^>]*>?/gm, '').trim().length > 0;

  return (
    <>
      <div className="diagram-controls">

        {/* Undo / Redo */}
        <div className="history-controls">
          <button onClick={onUndo} disabled={!canUndo || isLocked} title="Undo">↶ Undo</button>
          <button onClick={onRedo} disabled={!canRedo || isLocked} title="Redo">↷ Redo</button>
        </div>

        <button
          onClick={onClearAll}
          disabled={isLocked}
          className="diagram-controls-clear"
        >
          Clear All
        </button>


        <div className="diagram-controls-divider" />

        {/* File actions */}
        <button onClick={onExport} disabled={isLocked}>Export JSON</button>
        <button onClick={onImportClick} disabled={isLocked}>Import JSON</button>
        <input type="file" accept=".json" ref={fileInputRef} style={{ display: "none" }} onChange={onFileChange} />

        <div className="diagram-controls-divider" />

        {engine === "MultiTape" && (
          <button onClick={() => onConvert("combined")}>⇄ Single-Tape</button>
        )}

        {engine === "Deterministic" && (
          <button onClick={() => onConvert("oneWay")}>⇄ One-Way Tape</button>
        )}

        {engine === "NonDeterministic" && (
          <button onClick={() => onConvert("ntm")}>⇄ DTM</button>
        )}

        <div className="diagram-controls-divider" />

        {/* Tools */}
        <button
          onClick={() => {
            setShowNote((v) => !v);
            if (!hasClickedNotes) setHasClickedNotes(true); 
          }}
          className={`notes-btn-main ${showNote ? "notes-btn--active" : ""} ${!hasClickedNotes && hasContent ? "notes-btn--pulsing" : ""}`}
          title="Toggle machine notes"
        >
          Notes
        </button>

      </div>

      {/* Sticky Note*/}
      {showNote && (
        <div
          className="sticky-note"
          style={{ left: position.x, top: position.y, width: size.width, height: size.height }}
        >
          <div
            className="sticky-note-header"
            onMouseDown={onHeaderMouseDown}
            style={{ cursor: isDragging ? "grabbing" : "grab" }}
          >
            <span className="sticky-note-title">Notes</span>
            <button
              className="sticky-note-close"
              onClick={() => setShowNote(false)}
              title="Close notes"
            >
              ✕
            </button>
          </div>

          <div className="note-toolbar">
            <button
              className={`note-toolbar-btn${activeFormats.bold ? " active" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); execFormat("bold"); }}
              title="Bold (Ctrl+B)"
            >
              <b>B</b>
            </button>
            <button
              className={`note-toolbar-btn${activeFormats.italic ? " active" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); execFormat("italic"); }}
              title="Italic (Ctrl+I)"
            >
              <i>I</i>
            </button>
            <div className="note-toolbar-sep" />
            <button
              className={`note-toolbar-btn${activeFormats.ul ? " active" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); execFormat("insertUnorderedList"); }}
              title="Bullet list"
            >
              • List
            </button>
            <button
              className="note-toolbar-btn"
              onMouseDown={(e) => { e.preventDefault(); execFormat("insertOrderedList"); }}
              title="Numbered list"
            >
              1. List
            </button>
            <div className="note-toolbar-sep" />
            <button
              className="note-toolbar-btn"
              onMouseDown={(e) => { e.preventDefault(); execFormat("removeFormat"); }}
              title="Clear formatting"
            >
              ✕ fmt
            </button>
          </div>

          <div
            ref={editorRef}
            className="note-editor"
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyUp={updateActiveFormats}
            onMouseUp={updateActiveFormats}
            data-placeholder="Write your notes here… Notes are saved with your diagram on export."
            spellCheck
          />

          <div className="sticky-note-resize" onMouseDown={onResizeMouseDown} />
        </div>
      )}
    </>
  );
}