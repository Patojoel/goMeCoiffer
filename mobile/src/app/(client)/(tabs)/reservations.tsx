import { SafeAreaView } from '@/components/ui/safe-area-view';
import { ClientSpaceView } from '@/modules/client-space/ui/client-space-view';

export default function ClientBookingsScreen() {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ClientSpaceView mode="bookings" />
    </SafeAreaView>
  );
}
