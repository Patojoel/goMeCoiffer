import { canAccessSalonSpace, selectSession, t } from '@gomecoiffer/client-core';
import { Link } from 'expo-router';
import Stack from 'expo-router/stack';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { EmptyState } from '@/components/feedback/empty-state';
import { Button } from '@/components/ui/button';
import { useAppSelector } from '@/lib/store/hooks';

export default function SalonSpaceGuardLayout() {
  const session = useAppSelector(selectSession);

  if (canAccessSalonSpace(session)) {
    return (
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="creer-organisation" options={{ title: t('salons.create.title') }} />
        <Stack.Screen name="choisir-salon" options={{ title: t('salons.switch.title') }} />
        <Stack.Screen name="ajouter-salon" options={{ title: t('salons.add.title') }} />
        <Stack.Screen name="roles" options={{ title: t('roles.title') }} />
        <Stack.Screen name="horaires" options={{ title: t('salons.hours.title') }} />
      </Stack>
    );
  }

  const isClientSession = session.kind === 'CLIENT';
  const title = isClientSession ? t('salon.guard.clientSessionTitle') : t('salon.guard.unauthenticatedTitle');
  const description = isClientSession
    ? t('salon.guard.clientSessionHint')
    : t('salon.guard.unauthenticatedHint');

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1"
        contentContainerClassName="gap-4 p-4"
      >
        <EmptyState
          title={title}
          description={description}
          action={
            <View className="gap-3">
              <Link href="/connexion" asChild>
                <Button title={t('common.signIn')} />
              </Link>
              {isClientSession ? (
                <Link href="/inscription" asChild>
                  <Button variant="outline" title={t('auth.signUp.title')} />
                </Link>
              ) : null}
              <Link href="/(client)/(tabs)" asChild>
                <Button variant="ghost" title={t('common.backHome')} />
              </Link>
            </View>
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}
