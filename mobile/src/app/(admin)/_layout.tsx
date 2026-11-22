import { canAccessSalonSpace, selectSession, t } from '@gomecoiffer/client-core';
import Stack from 'expo-router/stack';
import { ScrollView } from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { RequireSystemRole } from '@/components/navigation/require-system-role';
import { useAppSelector } from '@/lib/store/hooks';

export default function AdminGuardLayout() {
  const session = useAppSelector(selectSession);

  if (!(session.systemRoles.length > 0 && canAccessSalonSpace(session))) {
    return (
      <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          className="flex-1"
          contentContainerClassName="gap-4 p-4"
        >
          <RequireSystemRole>{null}</RequireSystemRole>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: t('platform.title') }} />
    </Stack>
  );
}
