import {
    Behavior,
    Orbweaver as OrbweaverCore,
    type OrbweaverOptions,
    type Renderer,
    CanvasAsciiRenderer,
    type CanvasAsciiRendererOptions,
    type RotateParams,
    RotateBehavior as RotateBehaviorCore,
    type BobParams,
    BobBehavior as BobBehaviorCore,
    type OrbitParams,
    OrbitBehavior as OrbitBehaviorCore,
    type CrosshairParams,
    CrosshairBehavior as CrosshairBehaviorCore
} from "orbweaver-core"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type OrbweaverContextType = {
    initialized: boolean;
    setInitialized: (initialized: boolean) => void;
    rendererRef: React.RefObject<Renderer | null>;
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    orbweaver: OrbweaverCore | null;
    orbweaverOptions: Partial<OrbweaverOptions>;
    logger: {
        log: (...args: any[]) => void;
        warn: (...args: any[]) => void;
        error: (...args: any[]) => void;
    }
} | null;

export const OrbweaverContext = React.createContext<OrbweaverContextType>(null);

export function useOrbweaver() {
    const context = React.useContext(OrbweaverContext);
    if (!context) throw new Error("OrbweaverContext not found");
    return context;
}

export const DEFAULT_FPS = 60;

export type OrbweaverProps = Partial<OrbweaverOptions> & {
    children: React.ReactNode;
    verbose?: boolean;
}

export function Orbweaver({ children, ...props }: OrbweaverProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [orbweaver, setOrbweaver] = useState<OrbweaverCore | null>(null);
    const rendererRef = useRef<Renderer | null>(null);
    let hasCanvas = false;
    const createdRef = useRef(false);
    const [initialized, setInitialized] = useState(false);
    const logger = useMemo(() => {
        if (props.verbose) {
            return {
                log: console.log,
                warn: console.warn,
                error: console.error,
            }
        }
        return {
            log: () => { },
            warn: () => { },
            error: () => { },
        }
    }, [props.verbose]);
    // Initialize orbweaver
    useEffect(() => {
        if (!createdRef.current) {
            createdRef.current = true;
            logger.log("creating orbweaver");
            setOrbweaver(new OrbweaverCore({
                renderer: props.renderer,
                fps: props.fps ?? DEFAULT_FPS,
                behavior: props.behavior,
            }));

            return () => {
                logger.log("destroying orbweaver");
                createdRef.current = false;
                setOrbweaver(ow => {
                    ow?.stop();
                    return null
                });
            }
        }
    }, [props.renderer, props.fps, props.behavior]);
    // Update orbweaver properties
    useEffect(() => {
        if (orbweaver) {
            logger.log("updating orbweaver");
            orbweaver.setTargetFPS(props.fps ?? DEFAULT_FPS);
            if (props.behavior) {
                orbweaver.setBehavior(props.behavior);
            }
        }
    }, [props.fps, props.behavior, orbweaver])
    // Start and stop orbweaver
    useEffect(() => {
        if (initialized && orbweaver) {
            logger.log("starting orbweaver");
            orbweaver.start();

            return () => {
                if (orbweaver) {
                    logger.log("stopping orbweaver");
                    orbweaver.stop();
                }
            }
        }
    }, [initialized, orbweaver])
    React.Children.forEach(children, (child) => {
        if (React.isValidElement(child)) {
            switch (child.type) {
                case Canvas: {
                    hasCanvas = true;
                    break;
                }
                default: {
                    break;
                }
            }
        }
    });
    if (!hasCanvas) {
        throw new Error("Orbweaver requires at least a single Canvas child component");
    }
    return <OrbweaverContext.Provider value={{
        initialized,
        logger,
        canvasRef,
        rendererRef,
        orbweaver,
        setInitialized,
        orbweaverOptions: props,
    }}>
        {children}
    </OrbweaverContext.Provider>;
}

export function Canvas({ renderer, rendererOptions, ...props }: Omit<React.CanvasHTMLAttributes<HTMLCanvasElement>, "onMouseMove"> & {
    renderer?: CanvasAsciiRenderer;
    rendererOptions?: CanvasAsciiRendererOptions;
    onMouseMove?: (event: React.MouseEvent<HTMLCanvasElement>, orbweaver: OrbweaverCore) => void;
}) {
    const { canvasRef, rendererRef, orbweaver, setInitialized, logger } = useOrbweaver();
    useEffect(() => {
        if (canvasRef.current) {
            const oldRenderer = rendererRef.current;
            const newRenderer = oldRenderer == null ? new CanvasAsciiRenderer(canvasRef.current, rendererOptions) : oldRenderer;
            rendererRef.current = newRenderer;
            if (orbweaver && newRenderer) {
                logger.log("setting renderer");
                oldRenderer?.destroy();
                orbweaver.setRenderer(newRenderer);
                setInitialized(true);

                return () => {
                    setInitialized(false);
                }
            }
        } else {
            logger.log("no canvas");
        }
    }, [renderer, rendererOptions, orbweaver, setInitialized, logger])
    useEffect(() => {
        if (canvasRef.current) {
            const renderer = rendererRef.current;
            if (renderer instanceof CanvasAsciiRenderer && renderer.getCanvas() !== canvasRef.current) {
                logger.log("setting canvas");
                renderer.setCanvas(canvasRef.current);
            }
        }
    })
    const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
        if (orbweaver) {
            props.onMouseMove?.(event, orbweaver);
        }
    }, [orbweaver, props.onMouseMove])
    return <canvas ref={canvasRef} {...props} onMouseMove={handleMouseMove} />;
}

function useOrbweaverBehavior(behaviorFactory: () => Behavior) {
    const { orbweaver, logger } = useOrbweaver();
    useEffect(() => {
        const behavior = behaviorFactory();
        if (orbweaver) {
            logger.log("adding behavior", behavior.type);
            orbweaver.addBehavior(behavior);
            return () => {
                logger.log("removing behavior", behavior.type);
                orbweaver.removeBehavior([behavior]);
            }
        }
    }, [orbweaver, behaviorFactory, logger])
}

export function RotateBehavior({ speed, direction }: RotateParams) {
    const behavior = useCallback(() => new RotateBehaviorCore({ speed, direction: direction ?? 1 }), [speed, direction]);
    useOrbweaverBehavior(behavior);
    return null;
}

export function BobBehavior({ amplitude, rate }: BobParams) {
    const behavior = useCallback(() => new BobBehaviorCore({ amplitude, rate: rate ?? 2 }), [amplitude, rate]);
    useOrbweaverBehavior(behavior);
    return null;
}

export function OrbitBehavior({ radiusUnits, angularSpeed, phase, axis }: OrbitParams) {
    const behavior = useCallback(() => new OrbitBehaviorCore({ radiusUnits, angularSpeed, phase: phase ?? 0, axis: axis ?? "both" }), [radiusUnits, angularSpeed, phase, axis]);
    useOrbweaverBehavior(behavior);
    return null;
}

export function CrosshairBehavior({ strength }: CrosshairParams) {
    const behavior = useCallback(() => new CrosshairBehaviorCore({ strength: strength ?? 1 }), [strength]);
    useOrbweaverBehavior(behavior);
    return null;
}