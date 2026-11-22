import { RequirePermission } from '@/components/navigation/require-permission';
import { AddSalonView } from '@/modules/salons/ui/add-salon/add-salon-view';

export default function AddSalonScreen() {
  return (
    <RequirePermission permission="organization:manage-salons" wrapDeniedInSafeArea>
      <AddSalonView />
    </RequirePermission>
  );
}
