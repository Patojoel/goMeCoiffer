import { t } from '@gomecoiffer/client-core';
import { Controller } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import { FieldHint } from '@/components/forms/field-hint';
import { OtpCodeField } from '@/components/forms/otp-code-field';
import { PhoneField } from '@/components/forms/phone-field';
import { Badge } from '@/components/ui/badge';
import { BrandBackdrop, BrandIcon, BrandLogo, IconTile } from '@/components/ui/brand';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { CheckboxField } from '@/components/ui/checkbox-field';
import { InlineAlert } from '@/components/ui/inline-alert';
import { TextField } from '@/components/ui/text-field';
import { ThemedText } from '@/components/ui/themed-text';
import { useOnlineStatus } from '@/lib/platform/setupPlatformListeners';
import { useSignUp } from './use-sign-up';

export type SignUpViewProps = {
  readonly onNavigate?: (path: string) => void;
  readonly isOnline?: boolean;
};

const ONBOARDING_STEPS = [
  { icon: 'userplus', tone: 'navy', step: '1. Créez votre compte', hint: 'Vérification SMS rapide.' },
  { icon: 'shop', tone: 'terra', step: '2. Configurez votre salon', hint: 'Ville, quartier et horaires.' },
  { icon: 'users', tone: 'violet', step: '3. Invitez votre équipe', hint: 'Rôles et permissions clairs.' },
  { icon: 'calendar', tone: 'green', step: '4. Recevez vos réservations', hint: 'Planning en temps réel.' },
] as const;

function SignUpViewContent({
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
    formError,
    isSubmitting,
    isResending,
    submitStep1,
    submitStep2,
    resendCode,
    goToPhoneStep,
    navigateTo,
  } = useSignUp({ onNavigate, isOnline });

  return (
    <View className="flex-1 bg-background">
      <BrandBackdrop />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        className="flex-1"
        contentContainerClassName="mx-auto w-full max-w-5xl gap-5 px-5 pt-6 pb-12"
      >
        <View className="gap-5 md:flex-row md:items-start md:justify-between md:gap-10">
          <View className="gap-4 md:flex-1 md:pt-2">
            <BrandLogo width={196} />

            <View className="gap-2">
              <Badge variant="accent" label={t('auth.hero.eyebrow')} />
              <ThemedText
                accessibilityRole="header"
                variant="title"
                className="text-3xl font-extrabold leading-tight tracking-tight"
              >
                {t('auth.signUp.headline')}
              </ThemedText>
              <ThemedText variant="muted" className="text-sm leading-5">
                {t('auth.signUp.subline')}
              </ThemedText>
            </View>

            <View className="gap-2.5">
              {ONBOARDING_STEPS.map((item) => (
                <Card key={item.step} className="flex-row items-center gap-3 p-3.5">
                  <IconTile name={item.icon} tone={item.tone} size={40} />
                  <View className="flex-1 gap-0.5">
                    <ThemedText className="text-xs font-bold">{item.step}</ThemedText>
                    <ThemedText variant="caption" className="text-[11px]">
                      {item.hint}
                    </ThemedText>
                  </View>
                </Card>
              ))}
            </View>
          </View>

          <View className="gap-4 md:w-[420px]">
            {step === 'phone' ? (
              <Card>
                <View className="flex-row items-center gap-3">
                  <IconTile name="userplus" tone="terra" size={44} />
                  <View className="flex-1 gap-0.5">
                    <CardTitle className="text-xl">{t('auth.signUp.step1Title')}</CardTitle>
                    <CardDescription>{t('auth.signUp.subline')}</CardDescription>
                  </View>
                </View>

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

                <Controller
                  control={step1Form.control}
                  name="acceptedTerms"
                  render={({ field: { onChange, value } }) => (
                    <CheckboxField
                      label={t('auth.signUp.termsLabel')}
                      checked={value}
                      onCheckedChange={onChange}
                      hint={t('auth.signUp.termsHint')}
                      error={step1Form.formState.errors.acceptedTerms?.message}
                      disabled={isSubmitting}
                    />
                  )}
                />

                <Button
                  icon="userplus"
                  title={t('auth.signUp.sendCode')}
                  onPress={() => void submitStep1()}
                  loading={isSubmitting}
                  disabled={!isOnline}
                />
              </Card>
            ) : (
              <Card>
                <View className="flex-row items-center gap-3">
                  <IconTile name="shield" tone="terra" size={48} />
                  <View className="flex-1 gap-0.5">
                    <CardTitle className="text-xl">{t('auth.signUp.step2Title')}</CardTitle>
                    <CardDescription>{t('auth.signUp.headline')}</CardDescription>
                  </View>
                </View>

                {sentInfo ? (
                  <InlineAlert
                    variant="info"
                    message={t('auth.signUp.codeSentHint', {
                      maskedPhone: sentInfo.maskedPhone,
                      minutes: sentInfo.minutes,
                    })}
                  />
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

                <Controller
                  control={step2Form.control}
                  name="name"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextField
                      label={t('auth.signUp.nameLabel')}
                      placeholder={t('auth.signUp.namePlaceholder')}
                      leadingIcon="userplus"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={step2Form.formState.errors.name?.message}
                      autoComplete="name"
                      textContentType="name"
                      editable={!isSubmitting}
                    />
                  )}
                />

                <Controller
                  control={step2Form.control}
                  name="email"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextField
                      label={t('auth.signUp.emailLabel')}
                      placeholder={t('auth.signUp.emailPlaceholder')}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={step2Form.formState.errors.email?.message}
                      keyboardType="email-address"
                      autoComplete="email"
                      textContentType="emailAddress"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isSubmitting}
                    />
                  )}
                />

                <Controller
                  control={step2Form.control}
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
                      error={step2Form.formState.errors.password?.message}
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
                  control={step2Form.control}
                  name="confirmPassword"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextField
                      label={t('auth.signUp.confirmPasswordLabel')}
                      placeholder={t('auth.signUp.confirmPasswordPlaceholder')}
                      leadingIcon="lock"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={step2Form.formState.errors.confirmPassword?.message}
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
                  control={step2Form.control}
                  name="acceptedTerms"
                  render={({ field: { onChange, value } }) => (
                    <CheckboxField
                      label={t('auth.signUp.termsLabel')}
                      checked={value}
                      onCheckedChange={onChange}
                      hint={t('auth.signUp.termsHint')}
                      error={step2Form.formState.errors.acceptedTerms?.message}
                      disabled={isSubmitting}
                    />
                  )}
                />

                <Button
                  icon="shield"
                  title={t('auth.signUp.confirmSubmit')}
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
            )}

            <Card>
              <ThemedText variant="muted" className="text-center text-xs">
                {t('auth.signUp.hasAccount')}
              </ThemedText>
              <Button
                variant="outline"
                icon="lock"
                title={t('common.signIn')}
                onPress={() => navigateTo('/connexion')}
              />
              <View className="flex-row items-center justify-center gap-2 pt-1">
                <BrandIcon name="users" size={15} color="#6E768C" />
                <FieldHint message={t('auth.signIn.staffOnlyFoot')} />
              </View>
            </Card>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function LiveSignUpView({ onNavigate }: { readonly onNavigate?: (path: string) => void }) {
  const isOnline = useOnlineStatus();
  return <SignUpViewContent onNavigate={onNavigate} isOnline={isOnline} />;
}

export function SignUpView({ onNavigate, isOnline }: SignUpViewProps) {
  if (isOnline !== undefined) {
    return <SignUpViewContent onNavigate={onNavigate} isOnline={isOnline} />;
  }
  return <LiveSignUpView onNavigate={onNavigate} />;
}
