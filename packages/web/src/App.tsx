import { useEffect, useRef } from "react";
import { Orbweaver } from "orbweaver-core";

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const orbweaverRef = useRef<Orbweaver | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ow = new Orbweaver(canvas, {
      cols: 100,
      rows: 36,
      // Green hues on a very dark green canvas
      foreground: "#A8FFB5", // mint green glyphs
      background: "#081B12", // deep green canvas
      behavior: [
        { type: "bob", amplitude: 0.45, rate: 1 },
        { type: "rotate", speed: 2.5, direction: -1 },
      ],
    });
    orbweaverRef.current = ow;
    ow.start();
    return () => {
      ow.stop();
      orbweaverRef.current = null;
    };
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        padding: "16px",
        gap: "12px",
        background: "#020F0A", // near-black with green cast
        color: "#CFF9D9",
      }}
    >
      <h1 style={{ margin: 0, color: "#E7FFE9" }}>Orbweaver Demo</h1>
      <p style={{ margin: 0, color: "#9EDDB0" }}>
        Gently undulating ASCII blob rendered on a canvas.
      </p>
      <div style={{ flex: 1, minHeight: 0 }}>
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 8,
            border: "1px solid #1E3A2F", // subtle green-tinted border
            background: "#081B12",
          }}
        />
      </div>
    </div>
  );
}

export default App;
