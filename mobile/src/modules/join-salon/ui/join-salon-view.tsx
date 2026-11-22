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
import { BrandBackdrop, BrandLogo, IconTile } from '@/components/ui/brand';
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
        'min-h-14 flex-row items-center gap-3.5 rounded-[20px] border p-4',
        isSelected ? 'border-accent/60 bg-accent/10' : 'border-white/95 bg-card/90',
      )}
      style={{
        borderCurve: 'continuous',
        boxShadow: '0 8px 22px rgba(32, 38, 73, 0.06)',
      }}
    >
      <IconTile name="shop" tone={isSelected ? 'terra' : 'navy'} size={42} />
      <View className="flex-1 gap-1">
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <ThemedText variant="headline" className="flex-1 font-bold">
            {item.salonName}
          </ThemedText>
          <Badge variant={isSelected ? 'default' : 'secondary'} label={t(`team.role.${item.role}`)} />
        </View>
        <ThemedText variant="muted" className="text-xs">
          {`${item.city} — ${item.district}`}
        </ThemedText>
        <ThemedText variant="caption">
          {t('auth.join.expiresAtLabel', { date: formatDateFr(item.expiresAt) })}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function JoinSalonHeaderCard() {
  return (
    <View className="gap-3">
      <BrandLogo width={180} />
      <Card>
        <View className="flex-row items-center gap-3.5">
          <IconTile name="users" tone="terra" size={48} />
          <View className="flex-1 gap-1">
            <Badge variant="accent" label={t('auth.hero.eyebrow')} />
            <CardTitle className="text-xl">{t('auth.join.headline')}</CardTitle>
            <CardDescription>{t('auth.join.subline')}</CardDescription>
          </View>
        </View>
      </Card>
    </View>
  );
}

function JoinSalonLoadingView() {
  return (
    <View className="flex-1 bg-background">
      <BrandBackdrop />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1"
        contentContainerClassName="mx-auto w-full max-w-xl gap-4 px-5 pt-6 pb-12"
      >
        <JoinSalonHeaderCard />
        <Card accessible role="status" aria-busy aria-label={t('common.loading')}>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-16 w-full" />
        </Card>
      </ScrollView>
    </View>
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
      <View className="flex-1 bg-background">
        <BrandBackdrop />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          className="flex-1"
          contentContainerClassName="mx-auto w-full max-w-xl gap-4 px-5 pt-6 pb-12"
        >
          <JoinSalonHeaderCard />
          <Card>
            {!isOnline ? (
              <InlineAlert variant="warning" message={t('common.offlineActionHint')} />
            ) : null}
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
              icon="shield"
              title={t('auth.join.sendCode')}
              onPress={() => void submitStep1()}
              loading={isSubmitting}
              disabled={!isOnline}
            />
            <Button
              variant="outline"
              icon="lock"
              title={t('common.signIn')}
              onPress={() => navigateTo('/connexion')}
            />
          </Card>
        </ScrollView>
      </View>
    );
  }

  if (step === 'prove') {
    return (
      <View className="flex-1 bg-background">
        <BrandBackdrop />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          className="flex-1"
          contentContainerClassName="mx-auto w-full max-w-xl gap-4 px-5 pt-6 pb-12"
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
            {!isOnline ? (
              <InlineAlert variant="warning" message={t('common.offlineActionHint')} />
            ) : null}
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
              icon="shield"
              title={t('auth.join.verifyPhone')}
              onPress={() => void submitStep2()}
              loading={isSubmitting}
              disabled={!isOnline}
            />

            <View className="gap-2.5">
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
      </View>
    );
  }

  if (signInRequiredSalonName !== null) {
    return (
      <View className="flex-1 bg-background">
        <BrandBackdrop />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          className="flex-1"
          contentContainerClassName="mx-auto w-full max-w-xl gap-4 px-5 pt-6 pb-12"
        >
          <BrandLogo width={180} />
          <Card>
            <View className="flex-row items-center gap-3">
              <IconTile name="sparkle" tone="green" size={44} />
              <View className="flex-1 gap-0.5">
                <CardTitle>{t('auth.join.signInRequiredTitle')}</CardTitle>
                <CardDescription>
                  {t('auth.join.signInRequiredHint', { salonName: signInRequiredSalonName })}
                </CardDescription>
              </View>
            </View>
            <Button
              icon="lock"
              title={t('common.signIn')}
              onPress={() => navigateTo('/connexion')}
            />
          </Card>
        </ScrollView>
      </View>
    );
  }

  if (invitationsQuery.isLoading || invitationsQuery.isFetching) {
    return <JoinSalonLoadingView />;
  }

  if (invitationsQuery.isError) {
    return (
      <View className="flex-1 bg-background">
        <BrandBackdrop />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          className="flex-1"
          contentContainerClassName="mx-auto w-full max-w-xl gap-4 px-5 pt-6 pb-12"
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
      </View>
    );
  }

  if (!invitationsQuery.data) {
    return <JoinSalonLoadingView />;
  }

  if (invitations.length === 0) {
    return (
      <View className="flex-1 bg-background">
        <BrandBackdrop />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          className="flex-1"
          contentContainerClassName="mx-auto w-full max-w-xl gap-4 px-5 pt-6 pb-12"
        >
          <JoinSalonHeaderCard />
          <EmptyState
            icon="users"
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
      </View>
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
          icon="users"
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
                leadingIcon="userplus"
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
                leadingIcon="lock"
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
                leadingIcon="lock"
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
            icon="userplus"
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
    <View className="flex-1 bg-background">
      <BrandBackdrop />
      <FlatList
        data={invitations}
        keyExtractor={(item) => item.invitationId}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        className="flex-1"
        contentContainerClassName="mx-auto w-full max-w-xl gap-4 px-5 pt-6 pb-12"
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
    </View>
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
