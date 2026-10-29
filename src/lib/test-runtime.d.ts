// Minimal runner declarations avoid importing Bun's global fetch extensions into app types.
declare module "bun:test" {
  export function test(name: string, run: () => unknown): void;
  export function describe(name: string, run: () => unknown): void;
  export function beforeEach(run: () => unknown): void;
  export function expect(value: unknown): {
    toBe(value: unknown): void;
    toEqual(value: unknown): void;
    toHaveLength(value: number): void;
    toBeGreaterThan(value: number): void;
  };
  export const mock: { module(name: string, factory: () => unknown): void };
}