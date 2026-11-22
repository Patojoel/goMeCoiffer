import { ThemedText, type ThemedTextProps } from '@/components/ui/themed-text';
import { cn } from '@/lib/ui/cn';

export type FieldHintProps = ThemedTextProps & {
  readonly message: string;
};

export function FieldHint({ message, className, ...props }: FieldHintProps) {
  return (
    <ThemedText variant="caption" className={cn('mt-1', className)} {...props}>
      {message}
    </ThemedText>
  );
}
