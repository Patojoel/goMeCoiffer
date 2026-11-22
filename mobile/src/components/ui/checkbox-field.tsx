import * as Haptics from 'expo-haptics';
import { useId } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { FieldHint } from '@/components/forms/field-hint';
import { cn } from '@/lib/ui/cn';
import { ThemedText } from './themed-text';

export type CheckboxFieldProps = {
  readonly label: string;
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  readonly hint?: string;
  readonly error?: string;
  readonly disabled?: boolean;
  readonly testID?: string;
  readonly className?: string;
};

export function CheckboxField({
  label,
  checked,
  onCheckedChange,
  hint,
  error,
  disabled = false,
  testID,
  className,
}: CheckboxFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const handlePress = () => {
    if (disabled) return;
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
    onCheckedChange(!checked);
  };

  return (
    <View className={cn('gap-1', className)}>
      <Pressable
        testID={testID}
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityState={{ checked, disabled }}
        accessibilityHint={error ?? hint}
        disabled={disabled}
        onPress={handlePress}
        className={cn('min-h-11 flex-row items-start gap-3 py-1.5', disabled && 'opacity-50')}
      >
        <View
          className={cn(
            'mt-0.5 h-5 w-5 items-center justify-center rounded-md border',
            checked
              ? 'border-accent bg-accent'
              : error
                ? 'border-destructive bg-card'
                : 'border-border bg-card/90',
          )}
          style={{ borderCurve: 'continuous' }}
        >
          {checked ? (
            <ThemedText className="text-xs font-bold text-accent-foreground">✓</ThemedText>
          ) : null}
        </View>
        <ThemedText className="flex-1 text-xs leading-5 text-foreground">{label}</ThemedText>
      </Pressable>

      {hint ? <FieldHint nativeID={hintId} message={hint} /> : null}
      {error ? (
        <ThemedText nativeID={errorId} variant="error" accessibilityRole="alert" className="text-xs">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}
