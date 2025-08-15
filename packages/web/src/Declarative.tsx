import type { CanvasAsciiRendererOptions } from "orbweaver-core";
import { BobBehavior, Canvas, OrbitBehavior, Orbweaver, RotateBehavior } from "orbweaver-react";
import { useState } from "react";

const rendererOptions: CanvasAsciiRendererOptions = {
    foreground: "#A8FFB5",
    background: "#081B12",
    cols: 60,
    rows: 50,
}

export function Declarative() {
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
            color: "#A8FFB5",
            fontFamily: "monospace",
        }}>FPS: {fps}
            <input type="range" min={1} max={144} value={fps} onChange={(e) => {
                const fps = parseInt(e.target.value);
                setFps(fps);
            }} />
        </label>
        <Orbweaver fps={fps}>
            <Canvas rendererOptions={rendererOptions} style={{
                width: "70%",
                height: "70%",
                borderRadius: 8,
                border: "1px solid #1E3A2F",
                background: "#081B12",
            }} />
            <RotateBehavior speed={1} direction={1} />
            <BobBehavior amplitude={0.05} rate={2.5} />
            <OrbitBehavior radiusUnits={0.15} angularSpeed={1} />
        </Orbweaver>
    </div>
}