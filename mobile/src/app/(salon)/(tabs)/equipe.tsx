import { SafeAreaView } from '@/components/ui/safe-area-view';
import { SalonTeamWorkspace } from '@/modules/team/ui/salon-team-workspace';

export default function SalonTeamScreen() {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <SalonTeamWorkspace />
    </SafeAreaView>
  );
}
