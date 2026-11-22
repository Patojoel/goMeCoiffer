import { cva, type VariantProps } from 'class-variance-authority';
import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Platform, Pressable, type PressableProps } from 'react-native';
import { cn } from '@/lib/ui/cn';
import { ThemedText } from './themed-text';

const buttonVariants = cva('min-h-11 flex-row items-center justify-center gap-2 rounded-xl px-4 py-2.5', {
  variants: {
    variant: {
      default: 'bg-primary',
      accent: 'bg-accent',
      secondary: 'bg-secondary',
      outline: 'border border-border bg-card',
      ghost: 'bg-transparent',
    },
    size: {
      md: 'min-h-11 px-4',
      sm: 'min-h-11 px-3',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
});

const labelVariants = cva('text-center text-sm font-semibold', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      accent: 'text-accent-foreground',
      secondary: 'text-secondary-foreground',
      outline: 'text-foreground',
      ghost: 'text-foreground',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> &
  VariantProps<typeof buttonVariants> & {
    readonly title: string;
    readonly loading?: boolean;
    readonly className?: string;
    readonly haptic?: boolean;
  };

export function Button({
  title,
  variant,
  size,
  loading = false,
  disabled = false,
  haptic = true,
  className,
  onPress,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const handlePress: NonNullable<PressableProps['onPress']> = (event) => {
    if (isDisabled) return;
    if (haptic && (Platform.OS === 'ios' || Platform.OS === 'android')) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
    onPress?.(event);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={handlePress}
      className={cn(buttonVariants({ variant, size }), className)}
      style={({ pressed }) => ({
        borderCurve: 'continuous',
        opacity: isDisabled ? 0.5 : pressed ? 0.75 : 1,
      })}
      {...props}
    >
      {loading ? <ActivityIndicator size="small" /> : null}
      <ThemedText className={labelVariants({ variant })}>{title}</ThemedText>
    </Pressable>
  );
}
