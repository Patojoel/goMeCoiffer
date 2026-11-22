import { formatDateFr, resolveApiErrorMessage, t } from '@gomecoiffer/client-core';
import type { InvitationsForProvenPhone } from '@gomecoiffer/contracts';
import { Controller } from 'react-hook-form';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { FieldHint } from '@/components/forms/field-hint';
import { OtpCodeField } from '@/components/forms/otp-code-field';
import { PhoneField } from '@/components/forms/phone-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { CheckboxField } from '@/components/ui/checkbox-field';
import { InlineAlert } from '@/components/ui/inline-alert';
import { Skeleton } from '@/components/ui/skeleton';
import { TextField } from '@/components/ui/text-field';
import { ThemedText } from '@/components/ui/themed-text';
import { useOnlineStatus } from '@/lib/platform/setupPlatformListeners';
import { cn } from '@/lib/ui/cn';
import { useJoinSalon } from './use-join-salon';

type ProvenInvitation = InvitationsForProvenPhone['invitations'][number];

export type JoinSalonViewProps = {
  readonly onNavigate?: (path: string) => void;
  readonly isOnline?: boolean;
};

function InvitationOptionCard({
  item,
  isSelected,
  onSelect,
}: {
  readonly item: ProvenInvitation;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.salonName}
      accessibilityState={{ selected: isSelected }}
      onPress={onSelect}
      className={cn(
        'min-h-11 gap-2 rounded-2xl border p-4',
        isSelected ? 'border-primary bg-secondary' : 'border-border bg-card',
      )}
      style={{ borderCurve: 'continuous' }}
    >
      <View className="flex-row items-center justify-between gap-2">
        <ThemedText variant="headline" className="flex-1">
          {item.salonName}
        </ThemedText>
        <Badge variant={isSelected ? 'default' : 'secondary'} label={t(`team.role.${item.role}`)} />
      </View>
      <ThemedText variant="muted">{`${item.city} — ${item.district}`}</ThemedText>
      <ThemedText variant="caption">
        {t('auth.join.expiresAtLabel', { date: formatDateFr(item.expiresAt) })}
      </ThemedText>
    </Pressable>
  );
}

function JoinSalonHeaderCard() {
  return (
    <Card>
      <Badge variant="secondary" label={t('auth.hero.eyebrow')} />
      <CardTitle>{t('auth.join.headline')}</CardTitle>
      <CardDescription>{t('auth.join.subline')}</CardDescription>
    </Card>
  );
}

function JoinSalonLoadingView() {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1 bg-background"
      contentContainerClassName="gap-4 p-4"
    >
      <JoinSalonHeaderCard />
      <Card accessible role="status" aria-busy aria-label={t('common.loading')}>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-16 w-full" />
      </Card>
    </ScrollView>
  );
}

function JoinSalonViewContent({
  onNavigate,
  isOnline,
}: {
  readonly onNavigate?: (path: string) => void;
  readonly isOnline: boolean;
}) {
  const {
    step,
    sentInfo,
    step1Form,
    step2Form,
    step3Form,
    invitationsQuery,
    invitations,
    account,
    selectedInvitation,
    selectInvitation,
    signInRequiredSalonName,
    formError,
    isSubmitting,
    isResending,
    submitStep1,
    submitStep2,
    submitNewAccountAcceptance,
    acceptExistingAccount,
    resendCode,
    goToPhoneStep,
    markNameModified,
    navigateTo,
  } = useJoinSalon({ onNavigate, isOnline });

  if (step === 'phone') {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        className="flex-1 bg-background"
        contentContainerClassName="gap-4 p-4"
      >
        <JoinSalonHeaderCard />
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

          <Button
            title={t('auth.join.sendCode')}
            onPress={() => void submitStep1()}
            loading={isSubmitting}
            disabled={!isOnline}
          />
          <Button variant="outline" title={t('common.signIn')} onPress={() => navigateTo('/connexion')} />
        </Card>
      </ScrollView>
    );
  }

  if (step === 'prove') {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        className="flex-1 bg-background"
        contentContainerClassName="gap-4 p-4"
      >
        <JoinSalonHeaderCard />
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
            title={t('auth.join.verifyPhone')}
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
      </ScrollView>
    );
  }

  if (signInRequiredSalonName !== null) {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1 bg-background"
        contentContainerClassName="gap-4 p-4"
      >
        <Card>
          <CardTitle>{t('auth.join.signInRequiredTitle')}</CardTitle>
          <CardDescription>
            {t('auth.join.signInRequiredHint', { salonName: signInRequiredSalonName })}
          </CardDescription>
          <Button title={t('common.signIn')} onPress={() => navigateTo('/connexion')} />
        </Card>
      </ScrollView>
    );
  }

  if (invitationsQuery.isLoading || invitationsQuery.isFetching) {
    return <JoinSalonLoadingView />;
  }

  if (invitationsQuery.isError) {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1 bg-background"
        contentContainerClassName="gap-4 p-4"
      >
        <JoinSalonHeaderCard />
        <ErrorState
          title={t('auth.join.headline')}
          description={resolveApiErrorMessage(invitationsQuery.error)}
          onRetry={() => void invitationsQuery.refetch()}
          isRetrying={invitationsQuery.isFetching}
        />
        <Button variant="ghost" title={t('auth.signUp.changePhone')} onPress={goToPhoneStep} />
      </ScrollView>
    );
  }

  if (!invitationsQuery.data) {
    return <JoinSalonLoadingView />;
  }

  if (invitations.length === 0) {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1 bg-background"
        contentContainerClassName="gap-4 p-4"
      >
        <JoinSalonHeaderCard />
        <EmptyState
          title={t('auth.join.emptyTitle')}
          description={t('auth.join.emptyHint')}
          action={
            <Button
              variant="outline"
              title={t('auth.signUp.changePhone')}
              onPress={goToPhoneStep}
              className="self-start"
            />
          }
        />
      </ScrollView>
    );
  }

  const footerContent = (
    <Card>
      {account === 'EXISTING' ? (
        <InlineAlert variant="info" message={t('auth.join.accountExistingHint')} />
      ) : (
        <InlineAlert variant="info" message={t('auth.join.accountNewHint')} />
      )}

      {!isOnline ? <InlineAlert variant="warning" message={t('common.offlineActionHint')} /> : null}
      {formError ? <InlineAlert variant="error" message={formError} /> : null}

      {account === 'EXISTING' ? (
        <Button
          title={t('auth.join.acceptAction')}
          onPress={() => void acceptExistingAccount()}
          loading={isSubmitting}
          disabled={!isOnline || !selectedInvitation}
        />
      ) : (
        <View className="gap-3">
          <Controller
            control={step3Form.control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField
                label={t('auth.signUp.nameLabel')}
                placeholder={t('auth.signUp.namePlaceholder')}
                value={value}
                onChangeText={(next) => {
                  markNameModified();
                  onChange(next);
                }}
                onBlur={onBlur}
                error={step3Form.formState.errors.name?.message}
                autoComplete="name"
                textContentType="name"
                editable={!isSubmitting}
              />
            )}
          />

          <Controller
            control={step3Form.control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField
                label={t('auth.signIn.passwordLabel')}
                placeholder={t('auth.signIn.passwordPlaceholder')}
                hint={t('auth.signUp.passwordHint')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={step3Form.formState.errors.password?.message}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting}
              />
            )}
          />

          <Controller
            control={step3Form.control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField
                label={t('auth.signUp.confirmPasswordLabel')}
                placeholder={t('auth.signUp.confirmPasswordPlaceholder')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={step3Form.formState.errors.confirmPassword?.message}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting}
              />
            )}
          />

          <Controller
            control={step3Form.control}
            name="termsAccepted"
            render={({ field: { onChange, value } }) => (
              <CheckboxField
                label={t('auth.signUp.termsLabel')}
                checked={value}
                onCheckedChange={onChange}
                hint={t('auth.signUp.termsHint')}
                error={step3Form.formState.errors.termsAccepted?.message}
                disabled={isSubmitting}
              />
            )}
          />

          <Button
            title={t('auth.join.acceptAction')}
            onPress={() => void submitNewAccountAcceptance()}
            loading={isSubmitting}
            disabled={!isOnline || !selectedInvitation}
          />
        </View>
      )}

      <Button
        variant="ghost"
        title={t('auth.signUp.changePhone')}
        onPress={goToPhoneStep}
        disabled={isSubmitting}
      />
    </Card>
  );

  return (
    <FlatList
      data={invitations}
      keyExtractor={(item) => item.invitationId}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      className="flex-1 bg-background"
      contentContainerClassName="gap-4 p-4"
      ListHeaderComponent={<JoinSalonHeaderCard />}
      renderItem={({ item }) => (
        <InvitationOptionCard
          item={item}
          isSelected={item.invitationId === selectedInvitation?.invitationId}
          onSelect={() => selectInvitation(item.invitationId)}
        />
      )}
      ListFooterComponent={footerContent}
    />
  );
}

function LiveJoinSalonView({ onNavigate }: { readonly onNavigate?: (path: string) => void }) {
  const isOnline = useOnlineStatus();
  return <JoinSalonViewContent onNavigate={onNavigate} isOnline={isOnline} />;
}

export function JoinSalonView({ onNavigate, isOnline }: JoinSalonViewProps) {
  if (isOnline !== undefined) {
    return <JoinSalonViewContent onNavigate={onNavigate} isOnline={isOnline} />;
  }
  return <LiveJoinSalonView onNavigate={onNavigate} />;
}
