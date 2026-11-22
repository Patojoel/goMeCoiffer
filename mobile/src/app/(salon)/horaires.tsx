import { RequirePermission } from '@/components/navigation/require-permission';
import { WeeklyScheduleEditor } from '@/modules/salons/ui/hours/weekly-schedule-editor';

export default function SalonHoursScreen() {
  return (
    <RequirePermission permission="salon-settings:edit" wrapDeniedInSafeArea>
      <WeeklyScheduleEditor />
    </RequirePermission>
  );
}
