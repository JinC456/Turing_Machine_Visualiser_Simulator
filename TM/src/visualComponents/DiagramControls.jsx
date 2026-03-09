import React, { useRef, useState, useEffect, useCallback } from "react";

export default function DiagramControls({ 
  handleClearAll, 
  Undo, 
  Redo, 
  handleExport,
  handleImport,
  canUndo,
  canRedo,
  isLocked,
  engine,
  onConvert,
  note,
  onNoteChange
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

  // Track active formats for toolbar button state
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
        handleImport(json);
      } catch (err) {
        alert("Failed to load file. Please ensure it is a valid JSON file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Sync external `note` (HTML string) into the editor when it changes from outside
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

  return (
    <>
      <div className="diagram-controls">
        <div className="history-controls">
          <button onClick={Undo} disabled={!canUndo || isLocked}>↶</button>
          <button onClick={Redo} disabled={!canRedo || isLocked}>↷</button>
        </div>

        <button onClick={handleClearAll} disabled={isLocked} style={isLocked ? { opacity: 0.5, cursor: 'not-allowed' } : {}}>
          Clear All
        </button>

        <button onClick={handleExport} disabled={isLocked}>Export JSON</button>
        <button onClick={onImportClick} disabled={isLocked}>Import JSON</button>

        <input type="file" accept=".json" ref={fileInputRef} style={{ display: "none" }} onChange={onFileChange} />

        <button
          onClick={() => setShowNote((v) => !v)}
          className={`notes-btn${showNote ? " notes-btn--active" : ""}`}
          title="Toggle machine notes"
        >
          Notes
        </button>

        {engine === "MultiTape" && (
          <button onClick={() => onConvert("combined")} className="Convert-btn">
            Single-Tape View
          </button>
        )}
      </div>

      {/* --- Sticky Note Panel --- */}
      {showNote && (
        <div
          className="sticky-note"
          style={{ left: position.x, top: position.y, width: size.width, height: size.height }}
        >
          {/* Drag handle */}
          <div className="sticky-note__header" onMouseDown={onHeaderMouseDown} style={{ cursor: "grab" }}>
            <span className="sticky-note__title">Notes</span>
            <button className="sticky-note__close" onClick={() => setShowNote(false)} title="Close notes">✕</button>
          </div>

          {/* Formatting toolbar */}
          <div className="note-toolbar">
            <button
              className={`note-toolbar__btn${activeFormats.bold ? " active" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); execFormat("bold"); }}
              title="Bold (Ctrl+B)"
            ><b>B</b></button>
            <button
              className={`note-toolbar__btn${activeFormats.italic ? " active" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); execFormat("italic"); }}
              title="Italic (Ctrl+I)"
            ><i>I</i></button>
            <div className="note-toolbar__sep" />
            <button
              className={`note-toolbar__btn${activeFormats.ul ? " active" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); execFormat("insertUnorderedList"); }}
              title="Bullet list"
            >• List</button>
            <button
              className="note-toolbar__btn"
              onMouseDown={(e) => { e.preventDefault(); execFormat("insertOrderedList"); }}
              title="Numbered list"
            >1. List</button>
            <div className="note-toolbar__sep" />
            <button
              className="note-toolbar__btn"
              onMouseDown={(e) => { e.preventDefault(); execFormat("removeFormat"); }}
              title="Clear formatting"
            >✕ fmt</button>
          </div>

          {/* Rich-text editor — always editable, never locked */}
          <div
            ref={editorRef}
            className="note-editor"
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyUp={updateActiveFormats}
            onMouseUp={updateActiveFormats}
            data-placeholder="Write your notes here… Bold, italic, and lists are supported. Notes are saved with your diagram on export."
            spellCheck
          />

          {/* Resize handle — bottom-right corner */}
          <div className="sticky-note__resize" onMouseDown={onResizeMouseDown} />
        </div>
      )}
    </>
  );
}