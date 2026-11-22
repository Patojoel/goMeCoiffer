import { t } from '@gomecoiffer/client-core';
import { Controller } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import { FieldHint } from '@/components/forms/field-hint';
import { OtpCodeField } from '@/components/forms/otp-code-field';
import { PhoneField } from '@/components/forms/phone-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { InlineAlert } from '@/components/ui/inline-alert';
import { TextField } from '@/components/ui/text-field';
import { useOnlineStatus } from '@/lib/platform/setupPlatformListeners';
import { useForgotPassword } from './use-forgot-password';

export type ForgotPasswordViewProps = {
  readonly onNavigate?: (path: string) => void;
  readonly isOnline?: boolean;
};

function ForgotPasswordViewContent({
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
  } = useForgotPassword({ onNavigate, isOnline });

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      className="flex-1 bg-background"
      contentContainerClassName="gap-4 p-4"
    >
      <Card>
        <Badge variant="secondary" label={t('auth.hero.eyebrow')} />
        <CardTitle>{t('auth.reset.headline')}</CardTitle>
        <CardDescription>{t('auth.reset.subline')}</CardDescription>
      </Card>

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
                hint={t('auth.reset.phoneHint')}
                error={step1Form.formState.errors.phone?.message}
                editable={!isSubmitting}
              />
            )}
          />

          <Button
            title={t('auth.reset.sendCode')}
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

          <Controller
            control={step2Form.control}
            name="newPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField
                label={t('auth.reset.newPasswordLabel')}
                placeholder={t('auth.signIn.passwordPlaceholder')}
                hint={t('auth.signUp.passwordHint')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={step2Form.formState.errors.newPassword?.message}
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

          <Button
            title={t('auth.reset.submit')}
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
        <View className="gap-3">
          <Button variant="outline" title={t('common.signIn')} onPress={() => navigateTo('/connexion')} />
          <Button
            variant="ghost"
            title={t('auth.signIn.createAccount')}
            onPress={() => navigateTo('/inscription')}
          />
        </View>
      </Card>
    </ScrollView>
  );
}

function LiveForgotPasswordView({ onNavigate }: { readonly onNavigate?: (path: string) => void }) {
  const isOnline = useOnlineStatus();
  return <ForgotPasswordViewContent onNavigate={onNavigate} isOnline={isOnline} />;
}

export function ForgotPasswordView({ onNavigate, isOnline }: ForgotPasswordViewProps) {
  if (isOnline !== undefined) {
    return <ForgotPasswordViewContent onNavigate={onNavigate} isOnline={isOnline} />;
  }
  return <LiveForgotPasswordView onNavigate={onNavigate} />;
}
