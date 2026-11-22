import { Switch, View } from 'react-native';
import { cn } from '@/lib/ui/cn';
import { ThemedText } from './themed-text';

export type SwitchRowProps = {
  readonly label: string;
  readonly description?: string;
  readonly value: boolean;
  readonly onValueChange: (next: boolean) => void;
  readonly disabled?: boolean;
  readonly testID?: string;
  readonly className?: string;
};

export function SwitchRow({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
  testID,
  className,
}: SwitchRowProps) {
  return (
    <View
      className={cn(
        'min-h-11 flex-row items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3',
        disabled && 'opacity-55',
        className,
      )}
      style={{ borderCurve: 'continuous' }}
    >
      <View className="flex-1 gap-0.5">
        <ThemedText variant="headline" className="text-sm">
          {label}
        </ThemedText>
        {description ? <ThemedText variant="caption">{description}</ThemedText> : null}
      </View>

      <Switch
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
      />
    </View>
  );
}
