export type BobBehavior = {
  type: "bob";
  amplitude: number;
  rate?: number; // defaults to 2.0
};

export type RotateBehavior = {
  type: "rotate";
  speed: number;
  direction?: number; // positive or negative; defaults to 1
};

export type Behavior = BobBehavior | RotateBehavior;
