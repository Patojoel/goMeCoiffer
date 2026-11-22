import { sessionStarted, t } from '@gomecoiffer/client-core';
import { createTestStore } from '@gomecoiffer/client-core/testing';
import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { OtpCodeField } from '@/components/forms/otp-code-field';
import { PhoneField } from '@/components/forms/phone-field';
import { RequirePermission } from '@/components/navigation/require-permission';
import { RequireSystemRole } from '@/components/navigation/require-system-role';
import { resolveHomeHref } from '@/lib/navigation/home-route';
import { StoreProvider } from '@/lib/store/StoreProvider';
import { Badge } from '../badge';
import { CheckboxField } from '../checkbox-field';
import { InlineAlert } from '../inline-alert';
import { SafeAreaView } from '../safe-area-view';
import { SegmentedTabs } from '../segmented-tabs';
import { SelectField } from '../select-field';
import { SwitchRow } from '../switch-row';
import { TextField } from '../text-field';

describe('Mobile form primitives, feedback and navigation guards', () => {
  describe('TextField', () => {
    it('renders label, requirement hint, guidance hint, error alert and forwards text input', async () => {
      const changes: string[] = [];
      await render(
        <TextField
          label="Nom du salon"
          requirementHint="Obligatoire"
          hint="Affiché aux clients sur la marketplace."
          error="Indiquez au moins 2 caractères."
          onChangeText={(value) => changes.push(value)}
        />,
      );

      expect(screen.getByText('Nom du salon')).toBeOnTheScreen();
      expect(screen.getByText('Obligatoire')).toBeOnTheScreen();
      expect(screen.getByText('Affiché aux clients sur la marketplace.')).toBeOnTheScreen();
      expect(screen.getByRole('alert')).toHaveTextContent('Indiquez au moins 2 caractères.');

      const user = userEvent.setup();
      await user.type(screen.getByLabelText('Nom du salon'), 'Go Beauty');
      expect(changes.at(-1)).toBe('Go Beauty');
    });

    it('toggles password visibility in secureTextEntry mode', async () => {
      await render(<TextField label="Mot de passe" secureTextEntry value="secret-pass" />);

      const input = screen.getByLabelText('Mot de passe');
      expect(input.props.secureTextEntry).toBe(true);

      const user = userEvent.setup();
      await user.press(screen.getByRole('button', { name: t('ui.input.showPassword') }));

      expect(screen.getByLabelText('Mot de passe').props.secureTextEntry).toBe(false);
      expect(screen.getByRole('button', { name: t('ui.input.hidePassword') })).toBeOnTheScreen();
    });
  });

  describe('CheckboxField', () => {
    it('exposes checkbox accessibility state, toggles on press and ignores presses when disabled', async () => {
      const toggled: boolean[] = [];
      const { rerender } = await render(
        <CheckboxField
          label="J'accepte les conditions"
          checked={false}
          hint={t('auth.signUp.termsHint')}
          error="Acceptez pour continuer."
          onCheckedChange={(next) => toggled.push(next)}
        />,
      );

      const checkbox = screen.getByRole('checkbox', { name: "J'accepte les conditions" });
      expect(checkbox).not.toBeChecked();
      expect(checkbox).toBeEnabled();
      expect(screen.getByText(t('auth.signUp.termsHint'))).toBeOnTheScreen();
      expect(screen.getByRole('alert')).toHaveTextContent('Acceptez pour continuer.');

      const user = userEvent.setup();
      await user.press(checkbox);
      expect(toggled).toEqual([true]);

      await rerender(
        <CheckboxField
          label="J'accepte les conditions"
          checked={true}
          disabled
          onCheckedChange={(next) => toggled.push(next)}
        />,
      );
      const disabledCheckbox = screen.getByRole('checkbox', { name: "J'accepte les conditions" });
      expect(disabledCheckbox).toBeChecked();
      expect(disabledCheckbox).toBeDisabled();
      await user.press(disabledCheckbox);
      expect(toggled).toEqual([true]);
    });
  });

  describe('Badge and InlineAlert', () => {
    it('renders badges and exposes alert role on error InlineAlert', async () => {
      await render(
        <>
          <Badge variant="success" label="Actif" />
          <InlineAlert variant="info" title="Astuce" message="Vérifiez votre numéro." />
          <InlineAlert
            variant="error"
            title="Connexion impossible"
            message="Numéro ou mot de passe incorrect."
            action={<Text>Réessayer</Text>}
          />
        </>,
      );

      expect(screen.getByText('Actif')).toBeOnTheScreen();
      expect(screen.getByText('Astuce')).toBeOnTheScreen();
      expect(screen.getByText('Vérifiez votre numéro.')).toBeOnTheScreen();
      expect(screen.getByRole('alert')).toBeOnTheScreen();
      expect(screen.getByText('Numéro ou mot de passe incorrect.')).toBeOnTheScreen();
      expect(screen.getByText('Réessayer')).toBeOnTheScreen();
    });
  });

  describe('SelectField', () => {
    const cities = [
      { value: 'YAOUNDE', label: 'Yaoundé', description: 'Centre' },
      { value: 'DOUALA', label: 'Douala', description: 'Littoral' },
      { value: 'BAFOUSSAM', label: 'Bafoussam', disabled: true },
    ] as const;

    it('opens the modal sheet, searches options, handles empty search and selects a value', async () => {
      const selected: string[] = [];
      await render(
        <SelectField
          label="Ville"
          value={null}
          options={cities}
          searchable
          hint="Choisissez la ville du salon."
          onChange={(next) => selected.push(next)}
        />,
      );

      const trigger = screen.getByRole('button', { name: 'Ville' });
      expect(screen.getByText(t('ui.select.placeholder'))).toBeOnTheScreen();

      const user = userEvent.setup();
      await user.press(trigger);

      expect(screen.getByText('Douala')).toBeOnTheScreen();
      const searchInput = screen.getByLabelText(t('ui.select.searchPlaceholder'));

      await user.type(searchInput, 'Garoua');
      expect(screen.getByText(t('ui.select.empty'))).toBeOnTheScreen();

      await user.clear(searchInput);
      await user.type(searchInput, 'doua');
      await user.press(screen.getByText('Douala'));

      expect(selected).toEqual(['DOUALA']);
      expect(screen.queryByLabelText(t('ui.select.searchPlaceholder'))).not.toBeOnTheScreen();
    });
  });

  describe('SwitchRow and SegmentedTabs', () => {
    it('toggles SwitchRow value and switches SegmentedTabs tabs', async () => {
      const switchValues: boolean[] = [];
      const tabValues: string[] = [];
      await render(
        <>
          <SwitchRow
            label="Ouvert le dimanche"
            description="Active la prise de rendez-vous le dimanche."
            value={false}
            onValueChange={(next) => switchValues.push(next)}
          />
          <SegmentedTabs
            value="members"
            items={[
              { value: 'members', label: t('team.tabs.members') },
              { value: 'invitations', label: t('team.tabs.invitations') },
            ]}
            onChange={(next) => tabValues.push(next)}
          />
        </>,
      );

      const switchControl = screen.getByRole('switch', { name: 'Ouvert le dimanche' });
      fireEvent(switchControl, 'valueChange', true);
      expect(switchValues).toEqual([true]);

      const user = userEvent.setup();
      const membersTab = screen.getByRole('tab', { name: t('team.tabs.members') });
      const invitationsTab = screen.getByRole('tab', { name: t('team.tabs.invitations') });
      expect(membersTab).toBeSelected();
      expect(invitationsTab).not.toBeSelected();

      await user.press(invitationsTab);
      expect(tabValues).toEqual(['invitations']);
    });
  });

  describe('PhoneField and OtpCodeField', () => {
    it('configures Cameroon phone prefix and SMS OTP autofill attributes', async () => {
      await render(
        <>
          <PhoneField label="Téléphone" />
          <OtpCodeField label="Code SMS" />
        </>,
      );

      expect(screen.getByText('+237')).toBeOnTheScreen();
      expect(screen.getByText(t('auth.signIn.phoneHint'))).toBeOnTheScreen();
      const phoneInput = screen.getByLabelText('Téléphone');
      expect(phoneInput.props.keyboardType).toBe('phone-pad');
      expect(phoneInput.props.autoComplete).toBe('tel');
      expect(phoneInput.props.textContentType).toBe('telephoneNumber');

      const otpInput = screen.getByLabelText('Code SMS');
      expect(otpInput.props.keyboardType).toBe('number-pad');
      expect(otpInput.props.textContentType).toBe('oneTimeCode');
      expect(otpInput.props.autoComplete).toBe('sms-otp');
      expect(otpInput.props.maxLength).toBe(6);
    });
  });

  describe('RequirePermission and RequireSystemRole', () => {
    it('shows protected content when permission is granted and explains refusal otherwise', async () => {
      const allowedStore = createTestStore();
      allowedStore.dispatch(
        sessionStarted({
          userId: 'u1',
          kind: 'STAFF',
          activeSalonId: 's1',
          permissions: ['staff:invite'],
          systemRoles: [],
          maskedPhone: null,
        }),
      );
      await render(
        <StoreProvider store={allowedStore}>
          <RequirePermission permission="staff:invite">
            <Text>Inviter un coiffeur</Text>
          </RequirePermission>
        </StoreProvider>,
      );
      expect(screen.getByText('Inviter un coiffeur')).toBeOnTheScreen();

      const deniedStore = createTestStore();
      deniedStore.dispatch(
        sessionStarted({
          userId: 'u2',
          kind: 'STAFF',
          activeSalonId: 's1',
          permissions: ['bookings:view-own'],
          systemRoles: [],
          maskedPhone: null,
        }),
      );
      await render(
        <StoreProvider store={deniedStore}>
          <RequirePermission permission="staff:invite">
            <Text>Inviter un coiffeur</Text>
          </RequirePermission>
        </StoreProvider>,
      );
      expect(screen.queryByText('Inviter un coiffeur')).not.toBeOnTheScreen();
      expect(screen.getByText(t('errors.forbidden.permission'))).toBeOnTheScreen();
      expect(screen.getByRole('link', { name: t('common.back') })).toBeOnTheScreen();
    });

    it('gates admin content behind staff system roles and blocks client sessions', async () => {
      const adminStore = createTestStore();
      adminStore.dispatch(
        sessionStarted({
          userId: 'admin-1',
          kind: 'STAFF',
          activeSalonId: null,
          permissions: [],
          systemRoles: ['SUPER_ADMIN'],
          maskedPhone: null,
        }),
      );
      await render(
        <StoreProvider store={adminStore}>
          <RequireSystemRole role="SUPER_ADMIN">
            <Text>Console GoMeCoiffer</Text>
          </RequireSystemRole>
        </StoreProvider>,
      );
      expect(screen.getByText('Console GoMeCoiffer')).toBeOnTheScreen();

      const clientStore = createTestStore();
      clientStore.dispatch(
        sessionStarted({
          userId: 'client',
          kind: 'CLIENT',
          activeSalonId: null,
          permissions: [],
          systemRoles: ['SUPER_ADMIN'],
          maskedPhone: '6 55 •• •• 22',
        }),
      );
      await render(
        <StoreProvider store={clientStore}>
          <RequireSystemRole>
            <Text>Console GoMeCoiffer</Text>
          </RequireSystemRole>
        </StoreProvider>,
      );
      expect(screen.queryByText('Console GoMeCoiffer')).not.toBeOnTheScreen();
      expect(screen.getByText(t('errors.forbidden.systemRole'))).toBeOnTheScreen();
      expect(screen.getByRole('link', { name: t('common.back') })).toBeOnTheScreen();
    });
  });

  describe('resolveHomeHref', () => {
    for (const [nextStep, expectedHref] of [
      ['PLATFORM_ADMIN', '/(admin)'],
      ['OPEN_SALON', '/(salon)/(tabs)'],
      ['CHOOSE_SALON', '/(salon)/choisir-salon'],
      ['CREATE_ORGANIZATION', '/(salon)/creer-organisation'],
    ] as const) {
      it(`maps nextStep ${nextStep} to route ${expectedHref}`, () => {
        expect(resolveHomeHref(nextStep)).toBe(expectedHref);
      });
    }
  });

  describe('SafeAreaView', () => {
    it('forwards className, applies positive context edge padding and renders safely without provider', async () => {
      await render(
        <SafeAreaView testID="no-provider-safe" className="flex-1 bg-background">
          <Text>Sans fournisseur</Text>
        </SafeAreaView>,
      );
      expect(screen.getByText('Sans fournisseur')).toBeOnTheScreen();
      expect(screen.getByTestId('no-provider-safe').props.className).toBe('flex-1 bg-background');

      await render(
        <SafeAreaInsetsContext.Provider value={{ top: 47, right: 0, bottom: 34, left: 0 }}>
          <SafeAreaView testID="with-insets-safe" edges={['top']} className="flex-1 bg-background">
            <Text>Avec encoche</Text>
          </SafeAreaView>
        </SafeAreaInsetsContext.Provider>,
      );
      expect(screen.getByText('Avec encoche')).toBeOnTheScreen();
      const safeNode = screen.getByTestId('with-insets-safe');
      expect(safeNode.props.className).toBe('flex-1 bg-background');
      expect(safeNode.props.style).toEqual([{ paddingTop: 47 }, undefined]);
    });
  });
});
