import { t } from '@/lib/i18n/i18n';

export function AdminHome() {
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">{t('admin.title')}</h1>
      <p className="text-muted-foreground">{t('admin.intro')}</p>
    </section>
  );
}
