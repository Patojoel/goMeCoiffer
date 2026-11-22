import { SafeAreaView } from '@/components/ui/safe-area-view';
import { SalonTeamWorkspace } from '@/modules/team/ui/salon-team-workspace';

import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { ThemedText } from '@/components/ui/themed-text';
import { Button } from '@/components/ui/button';

export default function SalonTeamScreen() {
  const { guide } = useLocalSearchParams();
  const router = useRouter();
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      {guide === '1' ? (
        <View className="mx-auto w-full max-w-2xl gap-2 px-5 pt-3">
          <ThemedText variant="headline">Étape 3 sur 3 · Votre équipe</ThemedText>
          <ThemedText>Invitez vos collaborateurs. Si vous travaillez seul, vous pouvez terminer ici.</ThemedText>
          <Button title="Terminer et ouvrir mon salon" onPress={() => router.replace('/(salon)/(tabs)')} />
        </View>
      ) : null}
      <SalonTeamWorkspace />
    </SafeAreaView>
  );
}
