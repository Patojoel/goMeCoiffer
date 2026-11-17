import { AppShell } from '@/components/AppShell';
import { t } from '@/lib/i18n/i18n';

export function SalonLayout() {
  return <AppShell space={t('salon.title')} navLabel={t('salon.title')} />;
}
