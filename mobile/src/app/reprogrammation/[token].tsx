import { t } from '@gomecoiffer/client-core';
import { Link, useLocalSearchParams } from 'expo-router';
import { ScrollView } from 'react-native';
import { FieldHint } from '@/components/forms/field-hint';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';

export default function RescheduleByTokenScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const hasToken = typeof token === 'string' && token.length > 0;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1 bg-background"
      contentContainerClassName="gap-4 p-4"
    >
      <Card>
        <CardTitle>{t('nav.salon.appointments')}</CardTitle>
        <CardDescription>
          {hasToken ? t('salon.appointments.emptyHint') : t('nav.notFound.hint')}
        </CardDescription>
        <FieldHint message={t('marketplace.intro')} />
        <Link href="/(client)/(tabs)" asChild>
          <Button variant="outline" title={t('common.backHome')} className="self-start" />
        </Link>
      </Card>
    </ScrollView>
  );
}
