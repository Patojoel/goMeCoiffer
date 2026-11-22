import { t } from '@gomecoiffer/client-core';
import { Controller } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import { FieldHint } from '@/components/forms/field-hint';
import { OtpCodeField } from '@/components/forms/otp-code-field';
import { PhoneField } from '@/components/forms/phone-field';
import { Badge } from '@/components/ui/badge';
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
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      className="flex-1 bg-background"
      contentContainerClassName="gap-4 p-4"
    >
      <Card>
        <Badge variant="secondary" label={t('auth.hero.eyebrow')} />
        <CardTitle>{t('auth.signUp.headline')}</CardTitle>
        <CardDescription>{t('auth.signUp.subline')}</CardDescription>
      </Card>

      {step === 'phone' ? (
        <Card>
          <CardTitle>{t('auth.signUp.step1Title')}</CardTitle>
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
            title={t('auth.signUp.sendCode')}
            onPress={() => void submitStep1()}
            loading={isSubmitting}
            disabled={!isOnline}
          />
        </Card>
      ) : (
        <Card>
          <CardTitle>{t('auth.signUp.step2Title')}</CardTitle>
          {sentInfo ? (
            <InlineAlert
              variant="info"
              message={t('auth.signUp.codeSentHint', {
                maskedPhone: sentInfo.maskedPhone,
                minutes: sentInfo.minutes,
              })}
            />
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

          <Controller
            control={step2Form.control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField
                label={t('auth.signUp.nameLabel')}
                placeholder={t('auth.signUp.namePlaceholder')}
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
            title={t('auth.signUp.confirmSubmit')}
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

      <Card>
        <ThemedText variant="muted">{t('auth.signUp.hasAccount')}</ThemedText>
        <FieldHint message={t('auth.signIn.staffOnlyFoot')} />
        <Button variant="outline" title={t('common.signIn')} onPress={() => navigateTo('/connexion')} />
      </Card>
    </ScrollView>
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
