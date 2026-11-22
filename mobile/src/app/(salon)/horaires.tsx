import { useLocalSearchParams } from 'expo-router';
import { RequirePermission } from '@/components/navigation/require-permission';
import { WeeklyScheduleEditor } from '@/modules/salons/ui/hours/weekly-schedule-editor';
import { OwnerGuide } from '@/modules/salons/ui/owner-guide';

export default function SalonHoursScreen() {
  const { guide } = useLocalSearchParams();
  return (
    <RequirePermission permission="salon-settings:edit" wrapDeniedInSafeArea>
      {guide === '1' ? <OwnerGuide /> : <WeeklyScheduleEditor />}
    </RequirePermission>
  );
}
