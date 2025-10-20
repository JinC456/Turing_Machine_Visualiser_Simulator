export default function NodeMenu() {
  return (
    <div className="node-menu">
      <div className="node-container"
        draggable
        onDragStart={(e) => e.dataTransfer.setData("node-type", "start")}>
        <span className="arrow">→</span>
        <div className="node start"></div>
      </div>

      <div className="node-container"
        draggable
        onDragStart={(e) => e.dataTransfer.setData("node-type", "normal")}>
        <div className="node normal"></div>
      </div>

      <div className="node-container"
        draggable
        onDragStart={(e) => e.dataTransfer.setData("node-type", "accept")}>
        <div className="node accept">
          <div className="inner-circle"></div>
        </div>
      </div>

      <div className="node-container"
        draggable
        onDragStart={(e) => e.dataTransfer.setData("node-type", "reject")}>
        <div className="node reject"></div>
      </div>
    </div>
  );
}
