import { AppShell } from '@/components/AppShell';
import { t } from '@/lib/i18n/i18n';

export function AdminLayout() {
  return <AppShell space={t('admin.title')} navLabel={t('admin.title')} />;
}
