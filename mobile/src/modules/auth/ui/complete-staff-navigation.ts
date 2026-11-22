import type { SessionSummary } from '@gomecoiffer/contracts';
import { resolveHomeHref } from '@/lib/navigation/home-route';

export type SelectActiveSalonFn = (input: { readonly salonId: string }) => {
  unwrap: () => Promise<{ readonly session: SessionSummary }>;
};

/**
 * Applies D-040: when a staff session has exactly one salon and no active salon selected yet,
 * selects that salon before navigating to its home route.
 */
export async function navigateAfterStaffSession(
  session: SessionSummary,
  selectActiveSalon: SelectActiveSalonFn,
  onNavigate: (path: string) => void,
): Promise<void> {
  const singleSalon = session.salons[0];
  if (
    session.nextStep === 'OPEN_SALON' &&
    session.salons.length === 1 &&
    !session.activeSalonId &&
    singleSalon
  ) {
    const updated = await selectActiveSalon({ salonId: singleSalon.id }).unwrap();
    onNavigate(resolveHomeHref(updated.session.nextStep));
    return;
  }
  onNavigate(resolveHomeHref(session.nextStep));
}
