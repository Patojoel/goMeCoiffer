import { t } from '@gomecoiffer/client-core';
import { View } from 'react-native';
import { TextField, type TextFieldProps } from '@/components/ui/text-field';
import { ThemedText } from '@/components/ui/themed-text';

export type PhoneFieldProps = Omit<
  TextFieldProps,
  'label' | 'keyboardType' | 'autoComplete' | 'textContentType' | 'leadingAdornment'
> & {
  readonly label?: string;
};

export function PhoneField({
  label = t('auth.signIn.phoneLabel'),
  hint = t('auth.signIn.phoneHint'),
  autoCapitalize = 'none',
  autoCorrect = false,
  ...props
}: PhoneFieldProps) {
  return (
    <TextField
      label={label}
      hint={hint}
      keyboardType="phone-pad"
      autoComplete="tel"
      textContentType="telephoneNumber"
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect}
      leadingAdornment={
        <View className="min-h-12 flex-row items-center justify-center border-r border-border/80 bg-secondary/80 px-3.5">
          <ThemedText variant="headline" className="text-xs font-bold text-secondary-foreground">
            +237
          </ThemedText>
        </View>
      }
      {...props}
    />
  );
}
