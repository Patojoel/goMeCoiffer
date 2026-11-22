import { RequirePermission } from '@/components/navigation/require-permission';
import { WeeklyScheduleEditor } from '@/modules/salons/ui/hours/weekly-schedule-editor';

import { useLocalSearchParams, useRouter } from 'expo-router';

export default function SalonHoursScreen() {
  const { guide } = useLocalSearchParams();
  const router = useRouter();
  return (
    <RequirePermission permission="salon-settings:edit" wrapDeniedInSafeArea>
      <WeeklyScheduleEditor guided={guide === '1'} onApply={guide === '1'
        ? () => router.replace('/(salon)/(tabs)/equipe?guide=1')
        : undefined} />
    </RequirePermission>
  );
}
