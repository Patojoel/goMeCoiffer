import { selectExpiredSessionKind, t } from '@gomecoiffer/client-core';
import { Controller } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import { FieldHint } from '@/components/forms/field-hint';
import { PhoneField } from '@/components/forms/phone-field';
import { Badge } from '@/components/ui/badge';
import { BrandBackdrop, BrandIcon, BrandLogo, IconTile } from '@/components/ui/brand';
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

const HERO_FEATURES = [
  { icon: 'calendar', tone: 'navy', title: 'Disponibilités', subtitle: 'En temps réel' },
  { icon: 'scissors', tone: 'terra', title: 'Réservations', subtitle: 'Sans conflit' },
  { icon: 'coins', tone: 'green', title: 'Paiement', subtitle: 'En ligne ou au salon' },
] as const;

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
        contentContainerClassName="mx-auto w-full max-w-5xl gap-5 px-5 pt-6 pb-12"
      >
        <View className="gap-5 md:flex-row md:items-start md:justify-between md:gap-10">
          <View className="gap-4 md:flex-1 md:pt-4">
            <BrandLogo width={196} />

            <View className="gap-2.5">
              <Badge variant="accent" label={t('auth.hero.eyebrow')} />
              <View className="h-1 w-10 rounded-full bg-accent" />
              <ThemedText
                accessibilityRole="header"
                variant="title"
                className="text-3xl font-extrabold leading-tight tracking-tight"
              >
                {t('auth.signIn.headline')}
              </ThemedText>
              <ThemedText variant="muted" className="text-sm leading-5">
                {t('auth.signIn.subline')}
              </ThemedText>
              <FieldHint message={t('auth.signIn.hint')} />
            </View>

            <View className="flex-row gap-2.5">
              {HERO_FEATURES.map((item) => (
                <Card key={item.title} className="flex-1 gap-2 p-3">
                  <IconTile name={item.icon} tone={item.tone} size={36} />
                  <View className="gap-0.5">
                    <ThemedText className="text-xs font-bold">{item.title}</ThemedText>
                    <ThemedText variant="caption" className="text-xs leading-5">
                      {item.subtitle}
                    </ThemedText>
                  </View>
                </Card>
              ))}
            </View>
          </View>

          <View className="gap-4 md:w-[410px]">
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

            <Card>
              <ThemedText variant="headline" className="text-center text-sm font-bold">
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
          </View>
        </View>
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
