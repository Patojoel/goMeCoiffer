import { SafeAreaView } from '@/components/ui/safe-area-view';
import { PlatformAdminsView } from '@/modules/platform/ui/platform-admins-view';

export default function AdminHomeScreen() {
  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <PlatformAdminsView />
    </SafeAreaView>
  );
}
