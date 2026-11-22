import { t } from '@gomecoiffer/client-core';
import { TextField, type TextFieldProps } from '@/components/ui/text-field';

export type OtpCodeFieldProps = Omit<
  TextFieldProps,
  'label' | 'keyboardType' | 'textContentType' | 'autoComplete' | 'maxLength'
> & {
  readonly label?: string;
};

export function OtpCodeField({
  label = t('auth.signUp.codeLabel'),
  autoCapitalize = 'none',
  autoCorrect = false,
  ...props
}: OtpCodeFieldProps) {
  return (
    <TextField
      label={label}
      keyboardType="number-pad"
      textContentType="oneTimeCode"
      autoComplete="sms-otp"
      maxLength={6}
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect}
      {...props}
    />
  );
}
