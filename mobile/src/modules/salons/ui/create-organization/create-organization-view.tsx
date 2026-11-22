import { t } from '@gomecoiffer/client-core';
import { ScrollView, View } from 'react-native';
import { useState } from 'react';
import { OwnerStepHero } from '../owner-step-hero';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { BrandBackdrop, BrandTopBar } from '@/components/ui/brand';
import { Card } from '@/components/ui/card';
import { InlineAlert } from '@/components/ui/inline-alert';
import { SafeAreaView } from '@/components/ui/safe-area-view';

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
  const [organizationName, setName] = useState('');
  const [showSalon, setShowSalon] = useState(false);
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

        <OwnerStepHero step={showSalon ? 2 : 1}
          title={showSalon ? 'Votre premier salon' : 'Votre organisation'}
          hint={showSalon ? 'Ces coordonnées identifient votre établissement.' : 'Une même organisation peut regrouper plusieurs salons.'} />
        {!showSalon && <Card>
          <TextField label="Nom de l’organisation" placeholder="Ex. Maison Awa" value={organizationName} maxLength={60} onChangeText={setName} />
          <Button title="Configurer mon premier salon" disabled={organizationName.trim().length < 2} onPress={() => setShowSalon(true)} />
        </Card>}
        <View style={{ display: showSalon ? 'flex' : 'none' }}>
        <Card>
          <Button variant="ghost" title="Modifier l’organisation" onPress={() => setShowSalon(false)} />
          {infoMessage ? <InlineAlert variant="info" message={infoMessage} /> : null}
          <SalonForm
            submitLabel={t('salons.form.submitCreate')}
            isSubmitting={isSubmitting}
            isOnline={isOnline}
            errorMessage={errorMessage}
            onSubmit={(values) => submit({ ...values, organizationName: organizationName.trim() })}
          />
        </Card>
        </View>
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
