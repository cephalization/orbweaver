import { useEffect, useRef, useState } from "react";
import {
  BobBehavior,
  CanvasAsciiRenderer,
  OrbitBehavior,
  Orbweaver,
  RotateBehavior,
} from "orbweaver-core";

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const orbweaverRef = useRef<Orbweaver | null>(null);
  const rendererRef = useRef<CanvasAsciiRenderer | null>(null);
  const behaviorsRef = useRef<{
    bob: BobBehavior;
    rotate: RotateBehavior;
    orbit: OrbitBehavior;
  } | null>(null);
  const [defaultValues, setDefaultValues] = useState({
    bob: { amplitude: 0.05, rate: 1 },
    rotate: { speed: 2.5, direction: -1 },
    orbit: { radiusUnits: 0.5, angularSpeed: 1 },
    // mint green hues
    foreground: "#A8FFB5",
    background: "#081B12",
    fps: 60, // Default FPS
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bob = new BobBehavior({ amplitude: 0.05, rate: 2.5 });
    const rotate = new RotateBehavior({ speed: 2.5, direction: -1 });
    const orbit = new OrbitBehavior({
      radiusUnits: 0.15,
      angularSpeed: 1,
    });
    const renderer = new CanvasAsciiRenderer(canvas, {
      cols: 120,
      rows: 42,
      foreground: defaultValues.foreground,
      background: defaultValues.background,
      // provide your own glyphs to render the orb in different ways
      // an empty string as the first glyph will render as a background cell
      // glyphs: [" ", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
      // glyphs: [" ", "🌍", "🌎", "🌏", "🌍", "🌎", "🌏", "🌍", "🌎", "🌏", "🌍"],
      // glyphs: [" ", "/", "|", "\\", "-", "+"],
    });
    rendererRef.current = renderer;
    const ow = new Orbweaver({
      renderer,
      behavior: [bob, rotate, orbit],
      fps: defaultValues.fps, // Set initial FPS
    });
    behaviorsRef.current = { bob, rotate, orbit };
    orbweaverRef.current = ow;
    setDefaultValues((dv) => ({
      ...dv,
      bob: { amplitude: bob.amplitude, rate: bob.rate },
      rotate: { speed: rotate.speed, direction: rotate.direction },
      orbit: {
        radiusUnits: orbit.radiusUnits,
        angularSpeed: orbit.angularSpeed,
      },
    }));
    ow.start();

    // Click to apply an impulse away from the click position
    const onClick = (e: MouseEvent) => {
      const { normalizedOffsetX, normalizedOffsetY, normalizedDistance } =
        renderer.clientToCell(e.clientX, e.clientY);
      if (normalizedDistance <= 1e-6) return;
      const strength = 8.0; // units/second (constant magnitude)
      const ux = -normalizedOffsetX / normalizedDistance; // toward center
      const uy = -normalizedOffsetY / normalizedDistance;
      orbweaverRef.current?.impulse({ x: ux * strength, y: uy * strength });
    };
    canvas.addEventListener("click", onClick);
    return () => {
      ow.stop();
      orbweaverRef.current = null;
      behaviorsRef.current = null;
      canvas.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        padding: "8px",
        gap: "12px",
        background: "#020F0A", // near-black with green cast
        color: "#CFF9D9",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: "12px",
          width: "100%",
          flexWrap: "wrap",
          maxWidth: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            paddingLeft: "8px",
          }}
        >
          <h1 style={{ margin: 0, color: "#E7FFE9" }}>Orbweaver Demo</h1>
          <div style={{ display: "flex", flexDirection: "row", gap: "4px" }}>
            <p style={{ margin: 0, color: "#9EDDB0" }}>
              Gently undulating ASCII blob rendered on a canvas. Click to apply
              an impulse away from the click position.
            </p>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: "12px",
            alignItems: "flex-start",
            width: "100%",
            overflow: "auto",
            maxWidth: "100%",
            background: "#081B12",
            borderRadius: 8,
            border: "1px solid #1E3A2F",
            padding: "8px",
          }}
        >
          <ColorPicker
            label="Foreground"
            value={defaultValues.foreground}
            onChange={(value) => {
              setDefaultValues((dv) => ({
                ...dv,
                foreground: value,
              }));
              rendererRef.current?.setForeground(value);
            }}
          />
          <ColorPicker
            label="Background"
            value={defaultValues.background}
            onChange={(value) => {
              setDefaultValues((dv) => ({
                ...dv,
                background: value,
              }));
              rendererRef.current?.setBackground(value);
            }}
          />
          <Slider
            label="Rotate Speed"
            min={0}
            max={10}
            step={0.1}
            defaultValue={defaultValues.rotate.speed}
            onChange={(value) => {
              behaviorsRef.current?.rotate?.set({ speed: value });
            }}
          />
          <Slider
            label="Rotate Direction"
            min={-1}
            max={1}
            step={1}
            defaultValue={defaultValues.rotate.direction}
            onChange={(value) => {
              behaviorsRef.current?.rotate?.set({ direction: value });
            }}
          />
          <Slider
            label="Bob Rate"
            min={0}
            max={5}
            step={0.1}
            defaultValue={defaultValues.bob.rate}
            onChange={(value) => {
              behaviorsRef.current?.bob?.set({ rate: value });
            }}
          />
          <Slider
            label="Bob Amplitude"
            min={0}
            max={1}
            step={0.1}
            defaultValue={defaultValues.bob.amplitude}
            onChange={(value) => {
              behaviorsRef.current?.bob?.set({ amplitude: value });
            }}
          />
          <Slider
            label="Orbit Radius"
            min={0}
            max={1}
            step={0.1}
            defaultValue={defaultValues.orbit.radiusUnits}
            onChange={(value) => {
              behaviorsRef.current?.orbit?.set({ radiusUnits: value });
            }}
          />
          <Slider
            label="Orbit Angular Speed"
            min={0}
            max={10}
            step={0.1}
            defaultValue={defaultValues.orbit.angularSpeed}
            onChange={(value) => {
              behaviorsRef.current?.orbit?.set({ angularSpeed: value });
            }}
          />
          <Slider
            label="Target FPS"
            min={1}
            max={120}
            step={1}
            defaultValue={defaultValues.fps}
            onChange={(value) => {
              setDefaultValues((dv) => ({ ...dv, fps: value }));
              orbweaverRef.current?.setTargetFPS(value);
            }}
          />
        </div>
      </div>
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

function Slider({
  label,
  min,
  max,
  step,
  defaultValue,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  onChange: (value: number) => void;
}) {
  const [innerValue, setInnerValue] = useState(defaultValue);
  return (
    <div style={{ display: "flex", flexDirection: "row", gap: "4px", alignItems: "flex-start" }}>
      <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {label}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          defaultValue={defaultValue}
          onChange={(e) => {
            const value = parseFloat(e.target.value);
            setInnerValue(value);
            onChange(value);
          }}
        />
      </label>
      <span style={{ color: "#9EDDB0" }}>{innerValue}</span>
    </div>
  );
}

function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {label}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export default App;
