import { Platform, View, type ViewProps } from 'react-native';
import { cn } from '@/lib/ui/cn';
import { ThemedText, type ThemedTextProps } from './themed-text';

export function Card({ className, style, ...props }: ViewProps) {
  return (
    <View
      className={cn(
        'gap-4 rounded-[23px] border border-white/95 bg-card/85 p-5 dark:border-slate-400/65',
        className,
      )}
      style={[
        {
          borderCurve: 'continuous',
          ...(Platform.OS === 'web' ? { backdropFilter: 'blur(16px)' } : {}),
          boxShadow: '0 10px 24px rgba(23, 33, 59, 0.15)',
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
