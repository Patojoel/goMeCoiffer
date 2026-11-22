import { View, type ViewProps } from 'react-native';
import { cn } from '@/lib/ui/cn';

export function Skeleton({ className, style, ...props }: ViewProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={cn('h-4 rounded-md bg-muted', className)}
      style={[{ borderCurve: 'continuous' }, style]}
      {...props}
    />
  );
}
