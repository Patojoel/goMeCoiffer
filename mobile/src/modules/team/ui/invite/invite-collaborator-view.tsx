import { t } from '@gomecoiffer/client-core';
import { Controller } from 'react-hook-form';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InlineAlert } from '@/components/ui/inline-alert';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { PhoneField } from '@/components/forms/phone-field';
import { useOnlineStatus } from '@/lib/platform/setupPlatformListeners';
import { TEAM_ROLE_OPTIONS } from '../team-list/use-team-list';
import { useInviteCollaborator } from './use-invite-collaborator';

export type InviteCollaboratorViewProps = {
  readonly isOnline?: boolean;
  readonly onOpenExternalUrl?: (url: string) => Promise<void> | void;
};

function InviteCollaboratorContent({
  isOnline,
  onOpenExternalUrl,
}: {
  readonly isOnline: boolean;
  readonly onOpenExternalUrl?: (url: string) => Promise<void> | void;
}) {
  const {
    control,
    errors,
    selectedRole,
    formError,
    successMessage,
    isSubmitting,
    onSubmit,
    shareOnWhatsApp,
  } = useInviteCollaborator({ isOnline, onOpenExternalUrl });

  return (
    <Card>
      <CardTitle>{t('team.invite.title')}</CardTitle>
      <CardDescription>{t('team.invite.subtitle')}</CardDescription>

      {!isOnline ? <InlineAlert variant="warning" message={t('common.offlineActionHint')} /> : null}
      {formError ? <InlineAlert variant="error" message={formError} /> : null}
      {successMessage ? (
        <InlineAlert
          variant="success"
          message={successMessage}
          action={
            <Button
              variant="outline"
              size="sm"
              title={t('team.invite.shareWhatsApp')}
              onPress={() => void shareOnWhatsApp()}
              className="mt-1 self-start"
            />
          }
        />
      ) : null}

      <Controller
        control={control}
        name="name"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label={t('team.invite.nameLabel')}
            placeholder={t('team.invite.namePlaceholder')}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.name?.message}
            editable={!isSubmitting}
          />
        )}
      />

      <Controller
        control={control}
        name="phone"
        render={({ field: { onChange, onBlur, value } }) => (
          <PhoneField
            label={t('team.invite.phoneLabel')}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.phone?.message}
            editable={!isSubmitting}
          />
        )}
      />

      <Controller
        control={control}
        name="role"
        render={({ field: { onChange, value } }) => (
          <SelectField
            label={t('team.invite.roleLabel')}
            value={value}
            options={TEAM_ROLE_OPTIONS}
            hint={selectedRole ? t(`team.roleDesc.${selectedRole}`) : undefined}
            error={errors.role?.message}
            disabled={isSubmitting}
            onChange={onChange}
          />
        )}
      />

      <Button
        title={t('team.invite.submit')}
        onPress={() => void onSubmit()}
        loading={isSubmitting}
        disabled={!isOnline}
      />
    </Card>
  );
}

function LiveInviteCollaboratorView({
  onOpenExternalUrl,
}: {
  readonly onOpenExternalUrl?: (url: string) => Promise<void> | void;
}) {
  const isOnline = useOnlineStatus();
  return <InviteCollaboratorContent isOnline={isOnline} onOpenExternalUrl={onOpenExternalUrl} />;
}

export function InviteCollaboratorView({ isOnline, onOpenExternalUrl }: InviteCollaboratorViewProps) {
  if (isOnline !== undefined) {
    return <InviteCollaboratorContent isOnline={isOnline} onOpenExternalUrl={onOpenExternalUrl} />;
  }
  return <LiveInviteCollaboratorView onOpenExternalUrl={onOpenExternalUrl} />;
}
