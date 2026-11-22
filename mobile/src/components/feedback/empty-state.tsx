import type { ReactNode } from 'react';
import { View } from 'react-native';
import { IconTile, type BrandIconName, type BrandTone } from '@/components/ui/brand';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';

export type EmptyStateProps = {
  readonly title: string;
  readonly description: string;
  readonly icon?: BrandIconName;
  readonly tone?: BrandTone;
  readonly action?: ReactNode;
};

export function EmptyState({
  title,
  description,
  icon = 'sparkle',
  tone = 'terra',
  action,
}: EmptyStateProps) {
  return (
    <Card>
      <View className="flex-row items-center gap-3">
        <IconTile name={icon} tone={tone} size={42} />
        <View className="flex-1 gap-0.5">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </View>
      </View>
      {action}
    </Card>
  );
}
