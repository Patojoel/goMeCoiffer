import { t } from '@gomecoiffer/client-core';
import { ScrollView } from 'react-native';
import { BrandBackdrop, BrandTopBar, PageHero } from '@/components/ui/brand';
import { Card } from '@/components/ui/card';
import { SafeAreaView } from '@/components/ui/safe-area-view';
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
      <BrandBackdrop />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        className="flex-1"
        contentContainerClassName="mx-auto w-full max-w-2xl gap-4 px-5 pt-4 pb-12"
      >
        <BrandTopBar logoWidth={160} />

        <PageHero
          icon="shop"
          tone="terra"
          title={t('salons.add.title')}
          subtitle={t('salons.add.subtitle')}
        />

        <Card>
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
