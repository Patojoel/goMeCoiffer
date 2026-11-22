import { resolveHomeTarget } from '@gomecoiffer/client-core';
import type { NextStep } from '@gomecoiffer/contracts';

export function resolveHomeHref(nextStep: NextStep): string {
  const target = resolveHomeTarget(nextStep);
  switch (target) {
    case 'admin':
      return '/(admin)';
    case 'salon-home':
      return '/(salon)/(tabs)';
    case 'choose-salon':
      return '/(salon)/choisir-salon';
    case 'create-organization':
      return '/(salon)/creer-organisation';
    default: {
      target satisfies never;
      throw new Error(`Unhandled home target: ${String(target)}`);
    }
  }
}
