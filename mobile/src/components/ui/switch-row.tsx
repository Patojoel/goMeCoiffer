import { Switch, View } from 'react-native';
import { cn } from '@/lib/ui/cn';
import { IconTile, type BrandIconName, type BrandTone } from './brand';
import { ThemedText } from './themed-text';

export type SwitchRowProps = {
  readonly label: string;
  readonly description?: string;
  readonly icon?: BrandIconName;
  readonly iconTone?: BrandTone;
  readonly value: boolean;
  readonly onValueChange: (next: boolean) => void;
  readonly disabled?: boolean;
  readonly testID?: string;
  readonly className?: string;
};

export function SwitchRow({
  label,
  description,
  icon,
  iconTone = 'navy',
  value,
  onValueChange,
  disabled = false,
  testID,
  className,
}: SwitchRowProps) {
  return (
    <View
      className={cn(
        'min-h-14 flex-row items-center justify-between gap-3 rounded-2xl border border-white/95 bg-card/85 px-3.5 py-3',
        disabled && 'opacity-55',
        className,
      )}
      style={{
        borderCurve: 'continuous',
        boxShadow: '0 4px 13px rgba(39, 40, 67, 0.035)',
      }}
    >
      {icon ? <IconTile name={icon} tone={iconTone} size={34} /> : null}
      <View className="flex-1 gap-0.5">
        <ThemedText variant="headline" className="text-xs font-bold">
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
        trackColor={{ false: '#CFD4E1', true: '#34A85C' }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}
