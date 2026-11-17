import { t } from '@/lib/i18n/i18n';
import { HealthStatus } from '@/modules/health/infra/ui/HealthStatus';

export function MarketplaceHome() {
  return (
    <>
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t('marketplace.title')}</h1>
        <p className="text-muted-foreground">{t('marketplace.intro')}</p>
      </section>
      <HealthStatus />
    </>
  );
}
