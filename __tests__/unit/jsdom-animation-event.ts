// jsdom does not implement `AnimationEvent`/`TransitionEvent`. React detects the
// (un)prefixed animation/transition event names from their presence on `window`
// at load time; when they are absent it registers the `webkit`-prefixed listener
// and never receives the standard `animationend`/`transitionend` events that
// tests dispatch. Defining them here — imported before React loads — keeps React
// on the standard event names so `onAnimationEnd`/`onTransitionEnd` fire in tests.

class AnimationEventPolyfill extends Event {
  readonly animationName: string;
  readonly elapsedTime: number;
  readonly pseudoElement: string;

  constructor(type: string, init?: AnimationEventInit) {
    super(type, init);
    this.animationName = init?.animationName ?? "";
    this.elapsedTime = init?.elapsedTime ?? 0;
    this.pseudoElement = init?.pseudoElement ?? "";
  }
}

class TransitionEventPolyfill extends Event {
  readonly propertyName: string;
  readonly elapsedTime: number;
  readonly pseudoElement: string;

  constructor(type: string, init?: TransitionEventInit) {
    super(type, init);
    this.propertyName = init?.propertyName ?? "";
    this.elapsedTime = init?.elapsedTime ?? 0;
    this.pseudoElement = init?.pseudoElement ?? "";
  }
}

if (typeof globalThis.AnimationEvent === "undefined") {
  globalThis.AnimationEvent = AnimationEventPolyfill as unknown as typeof AnimationEvent;
}

if (typeof globalThis.TransitionEvent === "undefined") {
  globalThis.TransitionEvent = TransitionEventPolyfill as unknown as typeof TransitionEvent;
}
