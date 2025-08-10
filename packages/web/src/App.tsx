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
  const behaviorsRef = useRef<{
    bob: BobBehavior;
    rotate: RotateBehavior;
    orbit: OrbitBehavior;
  } | null>(null);
  const [defaultValues, setDefaultValues] = useState({
    bob: { amplitude: 0.05, rate: 1 },
    rotate: { speed: 2.5, direction: -1 },
    orbit: { radiusUnits: 0.5, angularSpeed: 1 },
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
    const ow = new Orbweaver({
      renderer: new CanvasAsciiRenderer(canvas, {
        cols: 100,
        rows: 36,
        // Green hues on a very dark green canvas
        foreground: "#A8FFB5", // mint green glyphs
        background: "#081B12", // deep green canvas
      }),
      behavior: [bob, rotate, orbit],
    });
    behaviorsRef.current = { bob, rotate, orbit };
    orbweaverRef.current = ow;
    setDefaultValues({
      bob: { amplitude: bob.amplitude, rate: bob.rate },
      rotate: { speed: rotate.speed, direction: rotate.direction },
      orbit: {
        radiusUnits: orbit.radiusUnits,
        angularSpeed: orbit.angularSpeed,
      },
    });
    ow.start();
    return () => {
      ow.stop();
      orbweaverRef.current = null;
      behaviorsRef.current = null;
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
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: "12px",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <h1 style={{ margin: 0, color: "#E7FFE9" }}>Orbweaver Demo</h1>
          <p style={{ margin: 0, color: "#9EDDB0" }}>
            Gently undulating ASCII blob rendered on a canvas.
          </p>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: "8px",
            justifyContent: "flex-end",
            alignItems: "center",
            width: "100%",
            flexWrap: "wrap",
          }}
        >
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
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {label}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        defaultValue={defaultValue}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

export default App;
