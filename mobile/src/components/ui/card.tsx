import { View, type ViewProps } from 'react-native';
import { cn } from '@/lib/ui/cn';
import { ThemedText, type ThemedTextProps } from './themed-text';

export function Card({ className, style, ...props }: ViewProps) {
  return (
    <View
      className={cn('gap-3 rounded-2xl border border-border bg-card p-5', className)}
      style={[
        {
          borderCurve: 'continuous',
          boxShadow: '0 1px 2px rgba(23, 33, 59, 0.06)',
        },
        style,
      ]}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: ThemedTextProps) {
  return <ThemedText accessibilityRole="header" variant="headline" className={className} {...props} />;
}

export function CardDescription({ className, ...props }: ThemedTextProps) {
  return <ThemedText variant="muted" selectable className={className} {...props} />;
}
