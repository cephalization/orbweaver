import { type CanvasGradientRendererOptions } from "orbweaver-core";
import { BobBehavior, Canvas, CrosshairBehavior, OrbitBehavior, Orbweaver, RotateBehavior } from "orbweaver-react";
import { useState } from "react";

const rendererOptions: CanvasGradientRendererOptions = {
    cols: 160,
    rows: 120,
    background: "#12081B",
    colors: [
        "#12091a",
        "#1a0f2e",
        "#3a1c5d",
        "#6f2fa4",
        "#b5a8ff",
    ],
}

export function Gradient() {
    const [fps, setFps] = useState(24);
    return <div style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        gap: 16,
    }}>
        <label style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "#B5A8FF",
            fontFamily: "monospace",
        }}>FPS: {fps}
            <input type="range" min={1} max={144} value={fps} onChange={(e) => {
                const fps = parseInt(e.target.value);
                setFps(fps);
            }} />
        </label>
        <Orbweaver fps={fps}>
            <Canvas
                rendererOptions={rendererOptions}
                style={{
                    width: "70%",
                    height: "70%",
                    borderRadius: 8,
                    border: "1px solid #2F1E3A",
                    background: "#12081B",
                }}
                onMouseMove={
                    (e, o) => {
                        const coords = o.getRenderer()?.clientToCell?.(e.clientX, e.clientY);
                        if (coords) {
                            o.updateCrosshair(coords.col, coords.row);
                        }
                    }}
            />
            <RotateBehavior speed={1} direction={1} />
            <BobBehavior amplitude={0.05} rate={2.5} />
            <OrbitBehavior radiusUnits={0.15} angularSpeed={1} />
            <CrosshairBehavior strength={0.5} />
        </Orbweaver>
    </div>
}
