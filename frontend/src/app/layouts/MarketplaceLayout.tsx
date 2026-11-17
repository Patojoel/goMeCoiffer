import { Link } from 'react-router';
import { AppShell } from '@/components/AppShell';
import { buttonVariants } from '@/components/ui/button';
import { t } from '@/lib/i18n/i18n';

export function MarketplaceLayout() {
  return (
    <AppShell
      space={t('marketplace.title')}
      navLabel={t('marketplace.nav.label')}
      nav={
        <Link to="/salon" className={buttonVariants({ variant: 'ghost' })}>
          {t('marketplace.nav.salonSpace')}
        </Link>
      }
    />
  );
}
