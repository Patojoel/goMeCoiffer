import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { cn } from '@/lib/ui/cn';
import { ThemedText } from './themed-text';

const badgeVariants = cva('self-start rounded-lg px-2.5 py-1', {
  variants: {
    variant: {
      default: 'bg-primary',
      accent: 'bg-accent',
      secondary: 'bg-secondary',
      success: 'border border-success/30 bg-success/15',
      destructive: 'border border-destructive/30 bg-destructive/15',
      outline: 'border border-border bg-card',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const badgeTextVariants = cva('text-xs font-semibold', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      accent: 'text-accent-foreground',
      secondary: 'text-secondary-foreground',
      success: 'text-success',
      destructive: 'text-destructive',
      outline: 'text-foreground',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export type BadgeProps = Omit<ViewProps, 'children'> &
  VariantProps<typeof badgeVariants> & {
    readonly label?: string;
    readonly children?: ReactNode;
  };

export function Badge({ label, children, variant, className, style, ...props }: BadgeProps) {
  return (
    <View
      className={cn(badgeVariants({ variant }), className)}
      style={[{ borderCurve: 'continuous' }, style]}
      {...props}
    >
      {label !== undefined ? (
        <ThemedText className={badgeTextVariants({ variant })}>{label}</ThemedText>
      ) : (
        children
      )}
    </View>
  );
}
