import type { JestNativeMatchers } from '@testing-library/react-native/dist/matchers/types';

declare global {
  interface JestSpyInstance<TReturn = unknown, TArgs extends unknown[] = unknown[]> {
    (...args: TArgs): TReturn;
    mock: { calls: TArgs[]; results: { type: string; value: TReturn }[] };
    mockClear(): this;
    mockReset(): this;
    mockImplementation(fn: (...args: TArgs) => TReturn): this;
    mockReturnValue(val: TReturn): this;
    mockResolvedValue(val: Awaited<TReturn>): this;
    mockRejectedValue(val: unknown): this;
  }

  namespace jest {
    interface Matchers<R, T = {}> extends JestNativeMatchers<R> {
      toBe(expected: unknown): R;
      toEqual(expected: unknown): R;
      toMatchObject(expected: Record<string, unknown> | unknown[]): R;
      toBeInstanceOf(expected: unknown): R;
      toBeNull(): R;
      toBeUndefined(): R;
      toBeDefined(): R;
      toBeTruthy(): R;
      toBeFalsy(): R;
      toBeGreaterThan(expected: number): R;
      toContain(expected: unknown): R;
      toHaveBeenCalled(): R;
      toHaveBeenCalledTimes(expected: number): R;
      toHaveBeenCalledWith(...args: unknown[]): R;
      toHaveLength(expected: number): R;
      toMatch(expected: string | RegExp): R;
      toThrow(expected?: unknown): R;
    }
  }

  interface AsymmetricMatcher {
    asymmetricMatch(other: unknown): boolean;
  }

  interface Expect {
    <T>(actual: T): jest.Matchers<void, T> & {
      not: jest.Matchers<void, T>;
      resolves: jest.Matchers<Promise<void>, Awaited<T>>;
      rejects: jest.Matchers<Promise<void>, unknown>;
    };
    extend(matchers: Record<string, unknown>): void;
    any(constructor: unknown): AsymmetricMatcher;
    objectContaining(expected: Record<string, unknown>): AsymmetricMatcher;
    stringContaining(expected: string): AsymmetricMatcher;
    stringMatching(expected: string | RegExp): AsymmetricMatcher;
  }

  const expect: Expect;
  function describe(name: string, fn: () => void): void;
  function it(name: string, fn: () => void | Promise<void>): void;
  function test(name: string, fn: () => void | Promise<void>): void;
  function beforeEach(fn: () => void | Promise<void>): void;
  function afterEach(fn: () => void | Promise<void>): void;
  function beforeAll(fn: () => void | Promise<void>): void;
  function afterAll(fn: () => void | Promise<void>): void;
  const jest: {
    fn<TReturn = unknown, TArgs extends unknown[] = unknown[]>(
      impl?: (...args: TArgs) => TReturn,
    ): JestSpyInstance<TReturn, TArgs>;
    useFakeTimers(): void;
    useRealTimers(): void;
    advanceTimersByTime(msToRun: number): void;
  };
}

export {};
