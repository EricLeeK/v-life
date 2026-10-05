import "@testing-library/jest-dom";

// Browser primitives used by the unmodified Arc sources; jsdom does not lay out elements.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof ResizeObserver;
}
if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = class {
    root = null;
    rootMargin = "0px";
    thresholds = [0];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  } as unknown as typeof IntersectionObserver;
}
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {};
if (!globalThis.CSS) globalThis.CSS = {} as typeof CSS;
if (!CSS.escape) CSS.escape = value => value.replace(/[^a-zA-Z0-9_-]/g, char => `\\${char}`);

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
