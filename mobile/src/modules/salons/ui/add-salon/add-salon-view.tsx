import { t } from '@gomecoiffer/client-core';
import { ScrollView } from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { SalonForm } from '../shared/salon-form';
import { WithScreenContext } from '../shared/screen-bridge';
import { useAddSalon } from './use-add-salon';

export type AddSalonViewProps = {
  readonly onNavigate?: (path: string) => void;
  readonly isOnline?: boolean;
};

function AddSalonContent({
  onNavigate,
  isOnline,
}: {
  readonly onNavigate: (path: string) => void;
  readonly isOnline: boolean;
}) {
  const { isSubmitting, errorMessage, submit } = useAddSalon({
    onNavigate,
    isOnline,
  });

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        className="flex-1"
        contentContainerClassName="gap-4 p-4"
      >
        <Card>
          <CardTitle>{t('salons.add.title')}</CardTitle>
          <CardDescription>{t('salons.add.subtitle')}</CardDescription>
          <SalonForm
            submitLabel={t('salons.form.submitAdd')}
            isSubmitting={isSubmitting}
            isOnline={isOnline}
            errorMessage={errorMessage}
            onSubmit={submit}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

export function AddSalonView({ onNavigate, isOnline }: AddSalonViewProps) {
  return (
    <WithScreenContext onNavigate={onNavigate} isOnline={isOnline}>
      {(ctx) => <AddSalonContent onNavigate={ctx.onNavigate} isOnline={ctx.isOnline} />}
    </WithScreenContext>
  );
}
