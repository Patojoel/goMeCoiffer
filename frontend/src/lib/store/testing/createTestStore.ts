import type { AppDependencies } from '../dependencies/AppDependencies';
import { createStore } from '../store';

const notProvided = (name: string) => () =>
  Promise.reject(new Error(`Gateway « ${name} » non fourni au test.`));

/** Gateways qui échouent bruyamment : un test ne fournit que ce qu'il exerce. */
const unprovided: AppDependencies = {
  health: { check: notProvided('health') },
};

export const createTestStore = (overrides: Partial<AppDependencies> = {}) =>
  createStore({ ...unprovided, ...overrides });
