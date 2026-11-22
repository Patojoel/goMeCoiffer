import { can, canAccessSalonSpace, selectSession, t } from '@gomecoiffer/client-core';
import { Link } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { BrandBackdrop, BrandTopBar, IconTile } from '@/components/ui/brand';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { SafeAreaView } from '@/components/ui/safe-area-view';
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
      <BrandBackdrop />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1"
        contentContainerClassName="mx-auto w-full max-w-2xl gap-4 px-5 pt-4 pb-12"
      >
        <BrandTopBar logoWidth={154} />

        <ActiveSalonCard />

        <Card>
          <View className="flex-row items-center gap-3">
            <IconTile name="settings" tone="terra" size={40} />
            <View className="flex-1 gap-0.5">
              <CardTitle>{t('salon.more.title')}</CardTitle>
              <CardDescription>{t('salon.more.hint')}</CardDescription>
            </View>
          </View>
          <View className="gap-2.5">
            <Link href="/(salon)/choisir-salon" asChild>
              <Button variant="outline" icon="shop" title={t('salons.more.switchSalon')} />
            </Link>
            {canManageSalons ? (
              <Link href="/(salon)/ajouter-salon" asChild>
                <Button variant="outline" icon="shop" title={t('salons.more.addSalon')} />
              </Link>
            ) : null}
            {canAdministerRoles ? (
              <Link href="/(salon)/roles" asChild>
                <Button variant="outline" icon="shield" title={t('salons.more.roles')} />
              </Link>
            ) : null}
            {canAccessHours ? (
              <Link href="/(salon)/horaires" asChild>
                <Button variant="outline" icon="clock" title={t('salons.more.hours')} />
              </Link>
            ) : null}
            {isPlatformAdmin ? (
              <Link href="/(admin)" asChild>
                <Button variant="secondary" icon="crown" title={t('salons.more.platformAdmin')} />
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
            icon="lock"
            title={t('auth.signOut.action')}
            loading={isSigningOut}
            onPress={() => void signOut()}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
