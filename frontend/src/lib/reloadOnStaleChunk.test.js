// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { installStaleChunkReload, shouldReload } from "./reloadOnStaleChunk";

function fakeTarget() {
  const listeners = {};
  return {
    addEventListener: (name, fn) => (listeners[name] = fn),
    fire: (name) => {
      const event = { preventDefault: vi.fn() };
      listeners[name](event);
      return event;
    },
    location: { reload: vi.fn() },
  };
}

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => (data[k] = v) };
}

describe("shouldReload", () => {
  it("recarrega na primeira vez", () => {
    expect(shouldReload(0, 1_000_000)).toBe(true);
  });

  it("não recarrega de novo em menos de 10 s (evita loop)", () => {
    expect(shouldReload(1_000_000, 1_005_000)).toBe(false);
    expect(shouldReload(1_000_000, 1_010_001)).toBe(true);
  });
});

describe("installStaleChunkReload", () => {
  it("recarrega a página quando um arquivo do deploy anterior some", () => {
    const target = fakeTarget();
    installStaleChunkReload(target, fakeStorage());
    const event = target.fire("vite:preloadError");
    expect(event.preventDefault).toHaveBeenCalled();
    expect(target.location.reload).toHaveBeenCalledOnce();
  });

  it("deixa o erro seguir se acabou de recarregar", () => {
    const target = fakeTarget();
    installStaleChunkReload(
      target,
      fakeStorage({ "despacha:stale-chunk-reload": String(Date.now()) }),
    );
    const event = target.fire("vite:preloadError");
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(target.location.reload).not.toHaveBeenCalled();
  });
});
