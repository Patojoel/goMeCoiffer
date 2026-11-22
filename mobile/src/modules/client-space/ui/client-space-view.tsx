import { selectExpiredSessionKind, t } from '@gomecoiffer/client-core';
import { Controller } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import { EmptyState } from '@/components/feedback/empty-state';
import { FieldHint } from '@/components/forms/field-hint';
import { OtpCodeField } from '@/components/forms/otp-code-field';
import { PhoneField } from '@/components/forms/phone-field';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { CheckboxField } from '@/components/ui/checkbox-field';
import { InlineAlert } from '@/components/ui/inline-alert';
import { useOnlineStatus } from '@/lib/platform/setupPlatformListeners';
import { useAppSelector } from '@/lib/store/hooks';
import { useClientSpace, type ClientSpaceMode } from './use-client-space';

export type ClientSpaceViewProps = {
  readonly mode?: ClientSpaceMode;
  readonly onNavigate?: (path: string) => void;
  readonly isOnline?: boolean;
};

function ClientBookingsEmptyState({
  onExplore,
}: {
  readonly onExplore: () => void;
}) {
  return (
    <EmptyState
      title={t('client.bookings.emptyTitle')}
      description={t('client.bookings.emptyHint')}
      action={
        <Button
          variant="accent"
          title={t('client.bookings.exploreAction')}
          onPress={onExplore}
          className="self-start"
        />
      }
    />
  );
}

function ClientSpaceViewContent({
  mode = 'profile',
  onNavigate,
  isOnline,
}: {
  readonly mode?: ClientSpaceMode;
  readonly onNavigate?: (path: string) => void;
  readonly isOnline: boolean;
}) {
  const expiredKind = useAppSelector(selectExpiredSessionKind);
  const {
    session,
    step,
    sentInfo,
    step1Form,
    step2Form,
    formError,
    isSubmitting,
    isResending,
    isSigningOut,
    submitStep1,
    submitStep2,
    resendCode,
    goToPhoneStep,
    signOutClient,
    navigateTo,
  } = useClientSpace({ mode, onNavigate, isOnline });

  if (session.kind === 'CLIENT') {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1 bg-background"
        contentContainerClassName="gap-4 p-4"
      >
        <Card>
          <CardTitle>{t('client.profile.title')}</CardTitle>
          <InlineAlert
            variant="success"
            message={t('client.access.connectedAs', { maskedPhone: session.maskedPhone ?? '' })}
          />
          <View className="gap-3">
            <Button
              variant="outline"
              title={t('client.access.signOut')}
              onPress={() => void signOutClient()}
              loading={isSigningOut}
            />
            <Button
              variant="ghost"
              title={t('client.access.changePhone')}
              onPress={() => void signOutClient()}
              disabled={isSigningOut}
            />
          </View>
        </Card>

        {mode === 'bookings' ? (
          <ClientBookingsEmptyState onExplore={() => navigateTo('/(client)/(tabs)')} />
        ) : (
          <Card>
            <FieldHint message={t('auth.signIn.hint')} />
            <Button variant="outline" title={t('common.signIn')} onPress={() => navigateTo('/connexion')} />
          </Card>
        )}
      </ScrollView>
    );
  }

  if (session.kind === 'STAFF') {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1 bg-background"
        contentContainerClassName="gap-4 p-4"
      >
        <Card>
          <CardTitle>{t('client.profile.title')}</CardTitle>
          <InlineAlert variant="info" message={t('client.access.staffActiveHint')} />
          <View className="gap-3">
            <Button
              variant="outline"
              title={t('marketplace.openSalonSpace')}
              onPress={() => navigateTo('/(salon)/(tabs)')}
            />
            {session.systemRoles.length > 0 ? (
              <Button
                variant="secondary"
                title={t('salons.more.platformAdmin')}
                onPress={() => navigateTo('/(admin)')}
              />
            ) : null}
          </View>
        </Card>

        {mode === 'bookings' ? (
          <ClientBookingsEmptyState onExplore={() => navigateTo('/(client)/(tabs)')} />
        ) : null}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      className="flex-1 bg-background"
      contentContainerClassName="gap-4 p-4"
    >
      <Card>
        <CardTitle>{t('client.access.headline')}</CardTitle>
        <CardDescription>{t('client.access.subline')}</CardDescription>
        {mode === 'profile' ? <FieldHint message={t('client.profile.hint')} /> : null}
      </Card>

      {expiredKind === 'CLIENT' ? (
        <InlineAlert variant="warning" message={t('errors.unauthenticated.client')} />
      ) : null}

      {step === 'phone' ? (
        <Card>
          {!isOnline ? <InlineAlert variant="warning" message={t('common.offlineActionHint')} /> : null}
          {formError ? <InlineAlert variant="error" message={formError} /> : null}

          <Controller
            control={step1Form.control}
            name="phone"
            render={({ field: { onChange, onBlur, value } }) => (
              <PhoneField
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={step1Form.formState.errors.phone?.message}
                editable={!isSubmitting}
              />
            )}
          />

          <Controller
            control={step1Form.control}
            name="termsAccepted"
            render={({ field: { onChange, value } }) => (
              <CheckboxField
                label={t('client.access.termsLabel')}
                checked={value}
                onCheckedChange={onChange}
                hint={t('auth.signUp.termsHint')}
                error={step1Form.formState.errors.termsAccepted?.message}
                disabled={isSubmitting}
              />
            )}
          />

          <Button
            title={t('client.access.sendCode')}
            onPress={() => void submitStep1()}
            loading={isSubmitting}
            disabled={!isOnline}
          />
        </Card>
      ) : (
        <Card>
          {sentInfo ? (
            <View className="gap-1.5">
              <InlineAlert
                variant="info"
                message={t('auth.signUp.codeSentHint', {
                  maskedPhone: sentInfo.maskedPhone,
                  minutes: sentInfo.minutes,
                })}
              />
              <FieldHint message={t('auth.reset.noSmsHint')} />
            </View>
          ) : null}

          {!isOnline ? <InlineAlert variant="warning" message={t('common.offlineActionHint')} /> : null}
          {formError ? <InlineAlert variant="error" message={formError} /> : null}

          <Controller
            control={step2Form.control}
            name="code"
            render={({ field: { onChange, onBlur, value } }) => (
              <OtpCodeField
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={step2Form.formState.errors.code?.message}
                editable={!isSubmitting}
              />
            )}
          />

          <Button
            title={t('client.access.verifySubmit')}
            onPress={() => void submitStep2()}
            loading={isSubmitting}
            disabled={!isOnline}
          />

          <View className="gap-3">
            <Button
              variant="outline"
              title={t('auth.signUp.resendCode')}
              onPress={() => void resendCode()}
              loading={isResending}
              disabled={!isOnline || isSubmitting}
            />
            <Button
              variant="ghost"
              title={t('auth.signUp.changePhone')}
              onPress={goToPhoneStep}
              disabled={isSubmitting || isResending}
            />
          </View>
        </Card>
      )}

      {mode === 'profile' ? (
        <Card>
          <FieldHint message={t('auth.signIn.hint')} />
          <View className="gap-3">
            <Button variant="outline" title={t('common.signIn')} onPress={() => navigateTo('/connexion')} />
            <Button
              variant="secondary"
              title={t('auth.signIn.joinWithInvite')}
              onPress={() => navigateTo('/rejoindre')}
            />
          </View>
          <FieldHint message={t('auth.signIn.staffOnlyFoot')} />
        </Card>
      ) : null}
    </ScrollView>
  );
}

function LiveClientSpaceView({
  mode,
  onNavigate,
}: {
  readonly mode?: ClientSpaceMode;
  readonly onNavigate?: (path: string) => void;
}) {
  const isOnline = useOnlineStatus();
  return <ClientSpaceViewContent mode={mode} onNavigate={onNavigate} isOnline={isOnline} />;
}

export function ClientSpaceView({ mode = 'profile', onNavigate, isOnline }: ClientSpaceViewProps) {
  if (isOnline !== undefined) {
    return <ClientSpaceViewContent mode={mode} onNavigate={onNavigate} isOnline={isOnline} />;
  }
  return <LiveClientSpaceView mode={mode} onNavigate={onNavigate} />;
}
