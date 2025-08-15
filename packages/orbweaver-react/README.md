# Orbweaver React

![NPM Version](https://img.shields.io/npm/v/orbweaver-react)

Declarative React bindings for Orbweaver.

See [orbweaver-core](https://www.npmjs.com/package/orbweaver-core) for more information.

## Installation

```bash
pnpm add orbweaver-react
```

## Usage

Orbweaver is a library for creating animated 2D orb graphics. This package provides a declarative API for creating Orbweaver orbs using React.

It responds to changes in props and children, and will automatically start and stop the orbweaver when the component is mounted and unmounted.

```tsx
import type { CanvasAsciiRendererOptions } from "orbweaver-core";
import { BobBehavior, Canvas, OrbitBehavior, Orbweaver, RotateBehavior } from "orbweaver-react";

const rendererOptions: CanvasAsciiRendererOptions = {
    foreground: "#A8FFB5",
    background: "#081B12",
    cols: 60,
    rows: 50,
}

export function Declarative() {
    return <div style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        gap: 16,
    }}>
        <Orbweaver fps={24}>
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
```