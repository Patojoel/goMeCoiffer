import { t } from '@gomecoiffer/client-core';
import { WebTabNav } from '@/components/navigation/web-tab-nav';

export default function ClientTabsWebLayout() {
  return (
    <WebTabNav
      spaceLabel={t('app.name')}
      items={[
        { label: t('nav.client.explore'), href: '/(client)/(tabs)', matchPath: '/' },
        {
          label: t('nav.client.bookings'),
          href: '/(client)/(tabs)/reservations',
          matchPath: '/reservations',
        },
        { label: t('nav.client.profile'), href: '/(client)/(tabs)/profil', matchPath: '/profil' },
      ]}
    />
  );
}
