# Orbweaver Architecture Plan

## Core Concepts

- Orbweaver is a library for rendering blob-like shapes.
- It supports:
  - Bring your own rendering backend (canvas, terminal ascii, etc)
  - Customizable colors
  - Responsive interaction (mouse, keyboard, audio, etc)

A "blob" is a shape that is defined by a set of points. You can think of it like a
configurable lava lamp blob.

## Core Components

- `Orbweaver` - The main class that manages the blob and its interactions.
- `Blob` - The class that represents a blob.
- `Renderer` - The class that renders the blob.
- `Interaction` - The class that handles the interaction with the blob.
- `Color` - The class that represents a color.
- `Point` - The class that represents a point.
- `Shape` - The class that represents a shape.

These components are designed to be generic and composable. The core orbweaver library
should be a set of generic components that can be used to render blobs.

## Core API

- `Orbweaver.createBlob(points: Point[])` - Create a new blob.
- `Orbweaver.render(blob: Blob)` - Render the blob.
- `Orbweaver.interact(blob: Blob, interaction: Interaction)` - Interact with the blob.

This API can be used in a react application, terminal application, etc. without the capabilties
being explicitly shipped with the library.

## Core Rendering Backends

- `TerminalRenderer` - Render the blob in the terminal.
- `CanvasRenderer` - Render the blob in a canvas.
- `WebGLRenderer` - Render the blob in a WebGL canvas.

TerminalRenderer and CanvasRenderer are the only two rendering backends that are
shipped with the library as of now.

## Core Interactions

- `PokeInteraction` - Interact with the blob using the mouse click / touch.
- `DragInteraction` - Interact with the blob using the mouse drag.
- `FollowInteraction` - Interact with the blob using the mouse / finger follow.
- `KeyboardInteraction` - Interact with the blob using the keyboard.
- `AudioInteraction` - Interact with the blob using audio.

Interactions can be created and used in your own application without the library needing to know 
about them. Orbweaver should be able to translate coordinates from application space to blob space, regardless of the renderer.

## Core Colors

- `Color` - The class that represents a color.
- `Gradient` - The class that represents a gradient.
- `Palette` - The class that represents a palette.