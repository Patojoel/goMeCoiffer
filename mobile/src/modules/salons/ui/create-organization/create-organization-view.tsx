import { t } from '@gomecoiffer/client-core';
import { ScrollView, View } from 'react-native';
import { Badge } from '@/components/ui/badge';
import { BrandBackdrop, BrandTopBar, PageHero } from '@/components/ui/brand';
import { Card } from '@/components/ui/card';
import { InlineAlert } from '@/components/ui/inline-alert';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { ThemedText } from '@/components/ui/themed-text';
import { SalonForm } from '../shared/salon-form';
import { WithScreenContext } from '../shared/screen-bridge';
import { useCreateOrganization } from './use-create-organization';

export type CreateOrganizationViewProps = {
  readonly onNavigate?: (path: string) => void;
  readonly isOnline?: boolean;
};

const STEP_LABELS = ['Salon', 'Horaires', 'Équipe'] as const;

function CreateOrganizationContent({
  onNavigate,
  isOnline,
}: {
  readonly onNavigate: (path: string) => void;
  readonly isOnline: boolean;
}) {
  const { isSubmitting, errorMessage, infoMessage, submit } = useCreateOrganization({
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

        <Card className="gap-3 p-4">
          <View className="flex-row items-center justify-between gap-2">
            <ThemedText className="text-base font-bold">Configuration du salon</ThemedText>
            <ThemedText className="text-base font-bold text-accent">Étape 1 sur 3</ThemedText>
          </View>
          <View className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <View className="h-full w-1/3 rounded-full bg-accent" />
          </View>
          <View className="flex-row flex-wrap gap-1.5">
            {STEP_LABELS.map((step, index) => (
              <Badge
                key={step}
                variant={index === 0 ? 'accent' : 'outline'}
                label={`${index + 1}. ${step}`}
              />
            ))}
          </View>
        </Card>

        <PageHero
          icon="shop"
          tone="terra"
          title={t('salons.create.title')}
          subtitle={t('salons.create.subtitle')}
        />

        <Card>
          {infoMessage ? <InlineAlert variant="info" message={infoMessage} /> : null}
          <SalonForm
            submitLabel={t('salons.form.submitCreate')}
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

export function CreateOrganizationView({ onNavigate, isOnline }: CreateOrganizationViewProps) {
  return (
    <WithScreenContext onNavigate={onNavigate} isOnline={isOnline}>
      {(ctx) => <CreateOrganizationContent onNavigate={ctx.onNavigate} isOnline={ctx.isOnline} />}
    </WithScreenContext>
  );
}
