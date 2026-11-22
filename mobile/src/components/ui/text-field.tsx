import { t } from '@gomecoiffer/client-core';
import { useId, useState, type ReactNode } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';
import { FieldHint } from '@/components/forms/field-hint';
import { cn } from '@/lib/ui/cn';
import { BrandIcon, type BrandIconName } from './brand';
import { ThemedText } from './themed-text';

export type TextFieldProps = Omit<TextInputProps, 'style'> & {
  readonly label: string;
  readonly requirementHint?: string;
  readonly hint?: string;
  readonly error?: string;
  readonly leadingIcon?: BrandIconName;
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
  leadingIcon,
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
  const resolvedIcon: BrandIconName | undefined = leadingIcon ?? (isPassword ? 'lock' : undefined);
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  return (
    <View className={cn('gap-1.5', containerClassName)}>
      <View className="flex-row items-center justify-between gap-2 px-0.5">
        <ThemedText nativeID={labelId} variant="headline" className="text-sm font-bold text-foreground">
          {label}
        </ThemedText>
        {requirementHint ? <ThemedText variant="caption">{requirementHint}</ThemedText> : null}
      </View>

      <View
        className={cn(
          'min-h-12 flex-row items-center rounded-[14px] border bg-card/85',
          error ? 'border-destructive' : 'border-border',
          !editable && 'bg-muted opacity-60',
        )}
        style={{
          borderCurve: 'continuous',
          boxShadow: '0 4px 13px rgba(39, 40, 67, 0.04)',
        }}
      >
        {leadingAdornment}
        {resolvedIcon ? (
          <View className="pl-3.5 pr-1">
            <BrandIcon name={resolvedIcon} size={18} color="#727A90" />
          </View>
        ) : null}
        <TextInput
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityHint={accessibilityHint ?? error ?? hint}
          aria-labelledby={labelId}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          editable={editable}
          secureTextEntry={isPassword ? !revealed : false}
          className={cn(
            'min-h-12 flex-1 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground',
            resolvedIcon && 'pl-2',
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
            className="min-h-11 min-w-11 flex-row items-center justify-center gap-1.5 px-3"
          >
            <BrandIcon name="eye" size={16} color="#D2603A" />
            <ThemedText variant="caption" className="font-bold text-accent">
              {revealed ? t('ui.input.hide') : t('ui.input.show')}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      {hint ? <FieldHint nativeID={hintId} message={hint} /> : null}
      {error ? (
        <ThemedText nativeID={errorId} variant="error" accessibilityRole="alert" className="text-xs">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}
