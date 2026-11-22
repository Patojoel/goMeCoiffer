import { t } from '@gomecoiffer/client-core';
import { useId, useState, type ReactNode } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';
import { FieldHint } from '@/components/forms/field-hint';
import { cn } from '@/lib/ui/cn';
import { ThemedText } from './themed-text';

export type TextFieldProps = Omit<TextInputProps, 'style'> & {
  readonly label: string;
  readonly requirementHint?: string;
  readonly hint?: string;
  readonly error?: string;
  readonly leadingAdornment?: ReactNode;
  readonly containerClassName?: string;
  readonly className?: string;
  readonly style?: TextInputProps['style'];
};

export function TextField({
  label,
  requirementHint,
  hint,
  error,
  leadingAdornment,
  containerClassName,
  className,
  style,
  secureTextEntry,
  editable = true,
  accessibilityLabel,
  accessibilityHint,
  ...props
}: TextFieldProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const [revealed, setRevealed] = useState(false);

  const isPassword = Boolean(secureTextEntry);
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  return (
    <View className={cn('gap-1.5', containerClassName)}>
      <View className="flex-row items-center justify-between gap-2">
        <ThemedText nativeID={labelId} variant="headline" className="text-sm">
          {label}
        </ThemedText>
        {requirementHint ? <ThemedText variant="caption">{requirementHint}</ThemedText> : null}
      </View>

      <View
        className={cn(
          'flex-row items-center rounded-xl border bg-card',
          error ? 'border-destructive' : 'border-border',
          !editable && 'bg-muted opacity-60',
        )}
        style={{ borderCurve: 'continuous' }}
      >
        {leadingAdornment}
        <TextInput
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityHint={accessibilityHint ?? error ?? hint}
          aria-labelledby={labelId}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          editable={editable}
          secureTextEntry={isPassword ? !revealed : false}
          className={cn(
            'min-h-11 flex-1 px-3.5 py-2.5 text-base text-foreground placeholder:text-muted-foreground',
            className,
          )}
          style={[{ borderCurve: 'continuous' }, style]}
          {...props}
        />
        {isPassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? t('ui.input.hidePassword') : t('ui.input.showPassword')}
            onPress={() => setRevealed((prev) => !prev)}
            className="min-h-11 min-w-11 items-center justify-center px-3"
          >
            <ThemedText variant="caption" className="font-semibold text-primary">
              {revealed ? t('ui.input.hide') : t('ui.input.show')}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      {hint ? <FieldHint nativeID={hintId} message={hint} /> : null}
      {error ? (
        <ThemedText nativeID={errorId} variant="error" accessibilityRole="alert" className="text-sm">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}
