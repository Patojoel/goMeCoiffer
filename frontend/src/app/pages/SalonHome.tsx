import { t } from '@/lib/i18n/i18n';

export function SalonHome() {
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">{t('salon.title')}</h1>
      <p className="text-muted-foreground">{t('salon.intro')}</p>
    </section>
  );
}
