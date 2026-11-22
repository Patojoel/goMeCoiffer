import { cva, type VariantProps } from 'class-variance-authority';
import { Text, type TextProps } from 'react-native';
import { cn } from '@/lib/ui/cn';

const textVariants = cva('text-foreground', {
  variants: {
    variant: {
      title: 'text-2xl font-bold tracking-tight',
      subtitle: 'text-lg font-semibold',
      headline: 'text-base font-semibold',
      body: 'text-base leading-6',
      muted: 'text-sm leading-5 text-muted-foreground',
      caption: 'text-xs leading-5 text-muted-foreground',
      error: 'text-base font-semibold text-destructive',
      success: 'text-base font-semibold text-success',
    },
  },
  defaultVariants: {
    variant: 'body',
  },
});

export type ThemedTextProps = TextProps & VariantProps<typeof textVariants>;

export function ThemedText({ className, variant, selectable, ...props }: ThemedTextProps) {
  return (
    <Text
      selectable={selectable ?? variant === 'error'}
      className={cn(textVariants({ variant }), className)}
      {...props}
    />
  );
}
