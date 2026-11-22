import { selectSalons, t } from '@gomecoiffer/client-core';
import { Link } from 'expo-router';
import { View } from 'react-native';
import { EmptyState } from '@/components/feedback/empty-state';
import { Button } from '@/components/ui/button';
import { useAppSelector } from '@/lib/store/hooks';

export function RequireActiveSalonNotice() {
  const salons = useAppSelector(selectSalons);
  const hasSalons = salons.length > 0;

  return (
    <EmptyState
      title={t('salons.guard.selectTitle')}
      description={t('salons.guard.selectHint')}
      action={
        <View className="gap-3">
          <Link href={hasSalons ? '/(salon)/choisir-salon' : '/(salon)/creer-organisation'} asChild>
            <Button title={hasSalons ? t('salons.guard.chooseAction') : t('salons.guard.createAction')} />
          </Link>
          <Link href="/(client)/(tabs)" asChild>
            <Button variant="outline" title={t('common.backHome')} />
          </Link>
        </View>
      }
    />
  );
}
