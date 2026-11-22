import { can, canAccessSalonSpace, selectSession, t } from '@gomecoiffer/client-core';
import { Link } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { useAppSelector } from '@/lib/store/hooks';
import { useSignOut } from '@/modules/auth/ui/sign-out/use-sign-out';
import { ActiveSalonCard } from '@/modules/salons/ui/active-salon-card';

export default function SalonMoreScreen() {
  const session = useAppSelector(selectSession);
  const { signOut, isSigningOut } = useSignOut();

  const canManageSalons = can(session, 'organization:manage-salons');
  const canAdministerRoles = can(session, 'roles:administer');
  const canAccessHours = can(session, 'salon-settings:edit') || can(session, 'salon-settings:view');
  const isPlatformAdmin = canAccessSalonSpace(session) && session.systemRoles.length > 0;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1"
        contentContainerClassName="gap-4 p-4"
      >
        <ActiveSalonCard />

        <Card>
          <CardTitle>{t('salon.more.title')}</CardTitle>
          <CardDescription>{t('salon.more.hint')}</CardDescription>
          <View className="gap-3">
            <Link href="/(salon)/choisir-salon" asChild>
              <Button variant="outline" title={t('salons.more.switchSalon')} />
            </Link>
            {canManageSalons ? (
              <Link href="/(salon)/ajouter-salon" asChild>
                <Button variant="outline" title={t('salons.more.addSalon')} />
              </Link>
            ) : null}
            {canAdministerRoles ? (
              <Link href="/(salon)/roles" asChild>
                <Button variant="outline" title={t('salons.more.roles')} />
              </Link>
            ) : null}
            {canAccessHours ? (
              <Link href="/(salon)/horaires" asChild>
                <Button variant="outline" title={t('salons.more.hours')} />
              </Link>
            ) : null}
            {isPlatformAdmin ? (
              <Link href="/(admin)" asChild>
                <Button variant="secondary" title={t('salons.more.platformAdmin')} />
              </Link>
            ) : null}
            <Link href="/(client)/(tabs)" asChild>
              <Button variant="ghost" title={t('common.backHome')} />
            </Link>
          </View>
        </Card>

        <Card>
          <Button
            variant="outline"
            title={t('auth.signOut.action')}
            loading={isSigningOut}
            onPress={() => void signOut()}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
