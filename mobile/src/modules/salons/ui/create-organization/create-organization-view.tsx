import { t } from '@gomecoiffer/client-core';
import { ScrollView } from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { InlineAlert } from '@/components/ui/inline-alert';
import { SalonForm } from '../shared/salon-form';
import { WithScreenContext } from '../shared/screen-bridge';
import { useCreateOrganization } from './use-create-organization';

export type CreateOrganizationViewProps = {
  readonly onNavigate?: (path: string) => void;
  readonly isOnline?: boolean;
};

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
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        className="flex-1"
        contentContainerClassName="gap-4 p-4"
      >
        <Card>
          <CardTitle>{t('salons.create.title')}</CardTitle>
          <CardDescription>{t('salons.create.subtitle')}</CardDescription>
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
