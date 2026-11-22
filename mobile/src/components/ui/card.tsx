import { View, type ViewProps } from 'react-native';
import { cn } from '@/lib/ui/cn';
import { ThemedText, type ThemedTextProps } from './themed-text';

export function Card({ className, style, ...props }: ViewProps) {
  return (
    <View
      className={cn(
        'gap-3.5 rounded-[23px] border border-white/90 bg-card/90 p-5',
        className,
      )}
      style={[
        {
          borderCurve: 'continuous',
          boxShadow: '0 13px 35px rgba(32, 38, 73, 0.085)',
        },
        style,
      ]}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: ThemedTextProps) {
  return (
    <ThemedText
      accessibilityRole="header"
      variant="headline"
      className={cn('text-lg font-bold tracking-tight', className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: ThemedTextProps) {
  return <ThemedText variant="muted" selectable className={cn('text-xs leading-5', className)} {...props} />;
}
