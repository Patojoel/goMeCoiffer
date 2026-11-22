import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { cn } from '@/lib/ui/cn';
import { ThemedText } from './themed-text';

const badgeVariants = cva('self-start flex-row items-center gap-1.5 rounded-full px-3 py-1', {
  variants: {
    variant: {
      default: 'bg-primary',
      accent: 'bg-accent/15 border border-accent/25',
      secondary: 'bg-secondary border border-white/90',
      success: 'border border-success/25 bg-success/15',
      destructive: 'border border-destructive/25 bg-destructive/15',
      outline: 'border border-white/95 bg-card/85',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const badgeTextVariants = cva('text-xs font-bold', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      accent: 'text-accent',
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
