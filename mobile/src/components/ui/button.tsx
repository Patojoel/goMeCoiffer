import { cva, type VariantProps } from 'class-variance-authority';
import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Platform, Pressable, useColorScheme, type PressableProps } from 'react-native';
import { cn } from '@/lib/ui/cn';
import { BrandIcon, type BrandIconName } from './brand';
import { ThemedText } from './themed-text';

const buttonVariants = cva(
  'min-h-12 flex-row items-center justify-center gap-2.5 rounded-[15px] px-4 py-3',
  {
    variants: {
      variant: {
        default: 'bg-primary',
        accent: 'bg-accent',
        secondary: 'border border-white/95 bg-secondary',
        outline: 'border border-border bg-card/85',
        ghost: 'bg-transparent',
      },
      size: {
        md: 'min-h-12 px-4',
        sm: 'min-h-11 rounded-xl px-3.5 py-2',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

const labelVariants = cva('shrink text-center text-sm font-bold', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      accent: 'text-accent-foreground',
      secondary: 'text-secondary-foreground',
      outline: 'text-foreground',
      ghost: 'text-accent',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const iconColors: Record<NonNullable<VariantProps<typeof buttonVariants>['variant']>, string> = {
  default: '#FFFFFF',
  accent: '#FFFFFF',
  secondary: '#17213B',
  outline: '#17213B',
  ghost: '#D2603A',
};

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> &
  VariantProps<typeof buttonVariants> & {
    readonly title: string;
    readonly icon?: BrandIconName;
    readonly loading?: boolean;
    readonly className?: string;
    readonly haptic?: boolean;
  };

export function Button({
  title,
  icon,
  variant = 'default',
  size,
  loading = false,
  disabled = false,
  haptic = true,
  className,
  onPress,
  ...props
}: ButtonProps) {
  const dark = useColorScheme() === 'dark';
  const isDisabled = disabled || loading;
  const resolvedVariant = variant ?? 'default';

  const iconColor = dark
    ? (resolvedVariant === 'default' || resolvedVariant === 'accent' ? '#17213B' : '#F6EFE6')
    : iconColors[resolvedVariant];

  const handlePress: NonNullable<PressableProps['onPress']> = (event) => {
    if (isDisabled) return;
    if (haptic && (Platform.OS === 'ios' || Platform.OS === 'android')) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
    onPress?.(event);
  };

  const shadowStyle =
    resolvedVariant === 'default'
      ? '0 8px 18px rgba(23, 33, 59, 0.18)'
      : resolvedVariant === 'accent'
        ? '0 8px 18px rgba(210, 96, 58, 0.22)'
        : resolvedVariant === 'outline' || resolvedVariant === 'secondary'
          ? '0 4px 13px rgba(23, 33, 59, 0.05)'
          : undefined;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={handlePress}
      className={cn(buttonVariants({ variant: resolvedVariant, size }), className)}
      style={({ pressed }) => ({
        borderCurve: 'continuous',
        boxShadow: shadowStyle,
        opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1,
      })}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : icon ? (
        <BrandIcon name={icon} size={18} color={iconColor} />
      ) : null}
      <ThemedText className={labelVariants({ variant: resolvedVariant })}>{title}</ThemedText>
    </Pressable>
  );
}
