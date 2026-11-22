import { t } from '@gomecoiffer/client-core';
import Stack from 'expo-router/stack';

export default function AuthLayout() {
  return (
    <Stack>
      <Stack.Screen name="connexion" options={{ title: t('auth.signIn.title') }} />
      <Stack.Screen name="inscription" options={{ title: t('auth.signUp.title') }} />
      <Stack.Screen name="mot-de-passe-oublie" options={{ title: t('auth.forgotPassword.title') }} />
      <Stack.Screen name="rejoindre" options={{ title: t('auth.joinSalon.title') }} />
    </Stack>
  );
}
