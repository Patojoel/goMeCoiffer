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
  className,
  ...props
}: OtpCodeFieldProps) {
  return (
    <TextField
      label={label}
      leadingIcon="shield"
      placeholder="• • • • • •"
      keyboardType="number-pad"
      textContentType="oneTimeCode"
      autoComplete="sms-otp"
      maxLength={6}
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect}
      className={className ?? 'min-h-14 text-center text-xl font-bold tracking-[6px]'}
      {...props}
    />
  );
}
