import { selectExpiredSessionKind, t } from '@gomecoiffer/client-core';
import { Controller } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import { FieldHint } from '@/components/forms/field-hint';
import { PhoneField } from '@/components/forms/phone-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { InlineAlert } from '@/components/ui/inline-alert';
import { TextField } from '@/components/ui/text-field';
import { ThemedText } from '@/components/ui/themed-text';
import { useOnlineStatus } from '@/lib/platform/setupPlatformListeners';
import { useAppSelector } from '@/lib/store/hooks';
import { useSignIn } from './use-sign-in';

export type SignInViewProps = {
  readonly onNavigate?: (path: string) => void;
  readonly isOnline?: boolean;
};

function SignInViewContent({
  onNavigate,
  isOnline,
}: {
  readonly onNavigate?: (path: string) => void;
  readonly isOnline: boolean;
}) {
  const expiredKind = useAppSelector(selectExpiredSessionKind);
  const { control, errors, formError, isSubmitting, onSubmit, navigateTo } = useSignIn({
    onNavigate,
    isOnline,
  });

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      className="flex-1 bg-background"
      contentContainerClassName="gap-4 p-4"
    >
      <Card>
        <Badge variant="secondary" label={t('auth.hero.eyebrow')} />
        <CardTitle>{t('auth.signIn.headline')}</CardTitle>
        <CardDescription>{t('auth.signIn.subline')}</CardDescription>
        <FieldHint message={t('auth.signIn.hint')} />
      </Card>

      <Card>
        {expiredKind === 'STAFF' ? (
          <InlineAlert variant="warning" message={t('errors.unauthenticated.staff')} />
        ) : null}
        {!isOnline ? <InlineAlert variant="warning" message={t('common.offlineActionHint')} /> : null}
        {formError ? <InlineAlert variant="error" message={formError} /> : null}

        <Controller
          control={control}
          name="phone"
          render={({ field: { onChange, onBlur, value } }) => (
            <PhoneField
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.phone?.message}
              editable={!isSubmitting}
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              label={t('auth.signIn.passwordLabel')}
              placeholder={t('auth.signIn.passwordPlaceholder')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.password?.message}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSubmitting}
            />
          )}
        />

        <Button
          title={t('auth.signIn.submit')}
          onPress={() => void onSubmit()}
          loading={isSubmitting}
          disabled={!isOnline}
        />

        <Button
          variant="ghost"
          title={t('auth.signIn.forgotPasswordLink')}
          onPress={() => navigateTo('/mot-de-passe-oublie')}
        />
      </Card>

      <Card>
        <ThemedText variant="headline">{t('auth.signIn.noAccount')}</ThemedText>
        <FieldHint message={t('auth.signIn.createAccountHint')} />
        <View className="gap-3">
          <Button
            variant="outline"
            title={t('auth.signIn.createAccount')}
            onPress={() => navigateTo('/inscription')}
          />
          <Button
            variant="secondary"
            title={t('auth.signIn.joinWithInvite')}
            onPress={() => navigateTo('/rejoindre')}
          />
        </View>
        <FieldHint message={t('auth.signIn.staffOnlyFoot')} />
      </Card>
    </ScrollView>
  );
}

function LiveSignInView({ onNavigate }: { readonly onNavigate?: (path: string) => void }) {
  const isOnline = useOnlineStatus();
  return <SignInViewContent onNavigate={onNavigate} isOnline={isOnline} />;
}

export function SignInView({ onNavigate, isOnline }: SignInViewProps) {
  if (isOnline !== undefined) {
    return <SignInViewContent onNavigate={onNavigate} isOnline={isOnline} />;
  }
  return <LiveSignInView onNavigate={onNavigate} />;
}
