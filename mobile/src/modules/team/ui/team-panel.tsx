import { t } from '@gomecoiffer/client-core';
import type { ReactNode } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { BrandBackdrop } from '@/components/ui/brand';
import { Button } from '@/components/ui/button';
import { SafeAreaView } from '@/components/ui/safe-area-view';

export function TeamPanel({
  children,
  onClose,
}: {
  readonly children: ReactNode;
  readonly onClose: () => void;
}) {
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-background">
        <BrandBackdrop />
        <View className="mx-auto w-full max-w-2xl flex-1">
          <View className="items-start px-5 pt-3">
            <Button variant="ghost" size="sm" title={t('team.directory.back')} onPress={onClose} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="px-5 pt-2 pb-10">
            {children}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
