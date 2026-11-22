import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { cn } from '@/lib/ui/cn';
import { ThemedText } from './themed-text';

const alertVariants = cva('gap-1.5 rounded-xl border p-4', {
  variants: {
    variant: {
      info: 'border-border bg-secondary',
      success: 'border-success/30 bg-success/10',
      error: 'border-destructive/30 bg-destructive/10',
      warning: 'border-accent/40 bg-accent/10',
    },
  },
  defaultVariants: {
    variant: 'info',
  },
});

const titleVariants = cva('text-sm font-semibold', {
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

export type InlineAlertProps = VariantProps<typeof alertVariants> & {
  readonly title?: string;
  readonly message: string;
  readonly action?: ReactNode;
  readonly className?: string;
};

export function InlineAlert({ variant = 'info', title, message, action, className }: InlineAlertProps) {
  const isError = variant === 'error';

  return (
    <View
      accessible
      role={isError ? 'alert' : 'status'}
      accessibilityLiveRegion="polite"
      className={cn(alertVariants({ variant }), className)}
      style={{ borderCurve: 'continuous' }}
    >
      {title ? <ThemedText className={titleVariants({ variant })}>{title}</ThemedText> : null}
      <ThemedText selectable={isError} className="text-sm leading-5 text-foreground">
        {message}
      </ThemedText>
      {action}
    </View>
  );
}
