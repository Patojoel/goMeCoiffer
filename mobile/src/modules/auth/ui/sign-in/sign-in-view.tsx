import { selectExpiredSessionKind, t } from '@gomecoiffer/client-core';
import { Controller } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import { FieldHint } from '@/components/forms/field-hint';
import { PhoneField } from '@/components/forms/phone-field';
import { SalonPhoto } from '@/components/ui/salon-photo';
import { BrandBackdrop, BrandIcon, BrandLogo } from '@/components/ui/brand';
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
    <View className="flex-1 bg-background">
      <BrandBackdrop />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        className="flex-1"
        contentContainerClassName="mx-auto w-full max-w-2xl gap-5 px-5 pt-6 pb-12"
      >
        <BrandLogo width={185} />
        <Card>
          <View className="gap-1">
            <CardTitle className="text-2xl">{t('auth.signIn.title')}</CardTitle>
            <CardDescription>{t('auth.signIn.subline')}</CardDescription>
          </View>

          {expiredKind === 'STAFF' ? (
            <InlineAlert variant="warning" message={t('errors.unauthenticated.staff')} />
          ) : null}
          {!isOnline ? (
            <InlineAlert variant="warning" message={t('common.offlineActionHint')} />
          ) : null}
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
                leadingIcon="lock"
                autoComplete="password"
                textContentType="password"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting}
              />
            )}
          />

          <View className="items-end">
            <Button
              variant="ghost"
              size="sm"
              title={t('auth.signIn.forgotPasswordLink')}
              onPress={() => navigateTo('/mot-de-passe-oublie')}
            />
          </View>

          <Button
            icon="lock"
            title={t('auth.signIn.submit')}
            onPress={() => void onSubmit()}
            loading={isSubmitting}
            disabled={!isOnline}
          />
        </Card>
        <SalonPhoto scene="barber" />

        <Card>
          <ThemedText variant="headline" className="text-center text-base font-bold">
            {t('auth.signIn.noAccount')}
          </ThemedText>
          <FieldHint message={t('auth.signIn.createAccountHint')} />
          <View className="gap-2.5">
            <Button
              variant="outline"
              icon="userplus"
              title={t('auth.signIn.createAccount')}
              onPress={() => navigateTo('/inscription')}
            />
            <Button
              variant="secondary"
              icon="users"
              title={t('auth.signIn.joinWithInvite')}
              onPress={() => navigateTo('/rejoindre')}
            />
          </View>
          <View className="flex-row items-center justify-center gap-2 pt-1">
            <BrandIcon name="users" size={15} color="#6E768C" />
            <FieldHint message={t('auth.signIn.staffOnlyFoot')} />
          </View>
        </Card>
      </ScrollView>
    </View>
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
