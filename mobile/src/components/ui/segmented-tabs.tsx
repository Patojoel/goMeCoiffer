import * as Haptics from 'expo-haptics';
import { Platform, Pressable, View } from 'react-native';
import { cn } from '@/lib/ui/cn';
import { ThemedText } from './themed-text';

export type SegmentedTabItem<T extends string> = {
  readonly value: T;
  readonly label: string;
  readonly disabled?: boolean;
};

export type SegmentedTabsProps<T extends string> = {
  readonly items: ReadonlyArray<SegmentedTabItem<T>>;
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly accessibilityLabel?: string;
  readonly className?: string;
};

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  accessibilityLabel,
  className,
}: SegmentedTabsProps<T>) {
  const handleSelect = (item: SegmentedTabItem<T>) => {
    if (item.disabled || item.value === value) return;
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      void Haptics.selectionAsync().catch(() => undefined);
    }
    onChange(item.value);
  };

  return (
    <View
      role="tablist"
      accessibilityLabel={accessibilityLabel}
      className={cn(
        'flex-row flex-wrap gap-1.5 rounded-2xl border border-white/90 bg-secondary/70 p-1.5',
        className,
      )}
      style={{ borderCurve: 'continuous' }}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <Pressable
            key={item.value}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected, disabled: Boolean(item.disabled) }}
            disabled={item.disabled}
            onPress={() => handleSelect(item)}
            className={cn(
              'min-h-11 flex-1 items-center justify-center rounded-xl px-3.5 py-2',
              selected ? 'bg-primary' : 'border border-white/80 bg-card/75',
              item.disabled && 'opacity-45',
            )}
            style={{
              borderCurve: 'continuous',
              boxShadow: selected ? '0 6px 14px rgba(23, 33, 59, 0.16)' : undefined,
            }}
          >
            <ThemedText
              className={cn(
                'text-center text-xs font-bold',
                selected ? 'text-primary-foreground' : 'text-muted-foreground',
              )}
            >
              {item.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}
