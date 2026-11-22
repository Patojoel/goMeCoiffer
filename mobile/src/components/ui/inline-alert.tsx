import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { cn } from '@/lib/ui/cn';
import { BrandIcon, type BrandIconName } from './brand';
import { ThemedText } from './themed-text';

const alertVariants = cva('flex-row items-start gap-2.5 rounded-[15px] border p-3.5', {
  variants: {
    variant: {
      info: 'border-white/95 bg-secondary/80',
      success: 'border-success/25 bg-success/10',
      error: 'border-destructive/30 bg-destructive/10',
      warning: 'border-accent/30 bg-accent/10',
    },
  },
  defaultVariants: {
    variant: 'info',
  },
});

const titleVariants = cva('text-xs font-bold', {
  variants: {
    variant: {
      info: 'text-foreground',
      success: 'text-success',
      error: 'text-destructive',
      warning: 'text-accent',
    },
  },
  defaultVariants: {
    variant: 'info',
  },
});

const alertIcons: Record<
  NonNullable<VariantProps<typeof alertVariants>['variant']>,
  { readonly icon: BrandIconName; readonly color: string }
> = {
  info: { icon: 'shield', color: '#3B64A1' },
  success: { icon: 'sparkle', color: '#167C37' },
  error: { icon: 'shield', color: '#C23B2B' },
  warning: { icon: 'clock', color: '#D2603A' },
};

export type InlineAlertProps = VariantProps<typeof alertVariants> & {
  readonly title?: string;
  readonly message: string;
  readonly action?: ReactNode;
  readonly className?: string;
};

export function InlineAlert({ variant = 'info', title, message, action, className }: InlineAlertProps) {
  const resolvedVariant = variant ?? 'info';
  const isError = resolvedVariant === 'error';
  const { icon, color } = alertIcons[resolvedVariant];

  return (
    <View
      accessible
      role={isError ? 'alert' : 'status'}
      accessibilityLiveRegion="polite"
      className={cn(alertVariants({ variant: resolvedVariant }), className)}
      style={{ borderCurve: 'continuous' }}
    >
      <View className="pt-0.5">
        <BrandIcon name={icon} size={17} color={color} />
      </View>
      <View className="flex-1 gap-1">
        {title ? (
          <ThemedText className={titleVariants({ variant: resolvedVariant })}>{title}</ThemedText>
        ) : null}
        <ThemedText selectable={isError} className="text-xs leading-5 text-foreground">
          {message}
        </ThemedText>
        {action}
      </View>
    </View>
  );
}
