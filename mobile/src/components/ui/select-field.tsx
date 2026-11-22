import { t } from '@gomecoiffer/client-core';
import * as Haptics from 'expo-haptics';
import { useId, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { FieldHint } from '@/components/forms/field-hint';
import { cn } from '@/lib/ui/cn';
import { Button } from './button';
import { ThemedText } from './themed-text';

export type SelectOption<T extends string> = {
  readonly value: T;
  readonly label: string;
  readonly description?: string;
  readonly disabled?: boolean;
};

export type SelectFieldProps<T extends string> = {
  readonly label: string;
  readonly value: T | null | undefined;
  readonly options: ReadonlyArray<SelectOption<T>>;
  readonly onChange: (value: T) => void;
  readonly placeholder?: string;
  readonly searchable?: boolean;
  readonly hint?: string;
  readonly error?: string;
  readonly disabled?: boolean;
  readonly testID?: string;
};

function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder,
  searchable = false,
  hint,
  error,
  disabled = false,
  testID,
}: SelectFieldProps<T>) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedOption = options.find((option) => option.value === value);
  const normalizedQuery = normalizeForSearch(query);
  const filteredOptions = normalizedQuery
    ? options.filter((option) => {
        const labelMatch = normalizeForSearch(option.label).includes(normalizedQuery);
        const descriptionMatch = option.description
          ? normalizeForSearch(option.description).includes(normalizedQuery)
          : false;
        return labelMatch || descriptionMatch;
      })
    : options;

  const handleClose = () => {
    setQuery('');
    setOpen(false);
  };

  const handleSelect = (optionValue: T) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      void Haptics.selectionAsync().catch(() => undefined);
    }
    onChange(optionValue);
    handleClose();
  };

  return (
    <View className="gap-1.5">
      <ThemedText nativeID={`${id}-label`} variant="headline" className="text-sm">
        {label}
      </ThemedText>

      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled, expanded: open }}
        accessibilityHint={error ?? hint}
        disabled={disabled}
        onPress={() => setOpen(true)}
        className={cn(
          'min-h-11 flex-row items-center justify-between gap-2 rounded-xl border bg-card px-3.5 py-2.5',
          error ? 'border-destructive' : 'border-border',
          disabled && 'bg-muted opacity-60',
        )}
        style={{ borderCurve: 'continuous' }}
      >
        <ThemedText className={cn('flex-1 text-base', !selectedOption && 'text-muted-foreground')}>
          {selectedOption ? selectedOption.label : (placeholder ?? t('ui.select.placeholder'))}
        </ThemedText>
        <ThemedText variant="muted" className="text-xs font-semibold">
          ▾
        </ThemedText>
      </Pressable>

      {hint ? <FieldHint nativeID={`${id}-hint`} message={hint} /> : null}
      {error ? (
        <ThemedText nativeID={`${id}-error`} variant="error" accessibilityRole="alert" className="text-sm">
          {error}
        </ThemedText>
      ) : null}

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleClose}
      >
        <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
          <View className="flex-row items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
            <ThemedText variant="subtitle" className="flex-1">
              {label}
            </ThemedText>
            <Button variant="outline" size="sm" title={t('ui.select.close')} onPress={handleClose} />
          </View>

          {searchable ? (
            <View className="border-b border-border bg-card px-4 py-3">
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('ui.select.searchPlaceholder')}
                accessibilityLabel={t('ui.select.searchPlaceholder')}
                autoCapitalize="none"
                autoCorrect={false}
                className="min-h-11 rounded-xl border border-border bg-background px-3.5 py-2.5 text-base text-foreground placeholder:text-muted-foreground"
                style={{ borderCurve: 'continuous' }}
              />
            </View>
          ) : null}

          <FlatList
            data={[...filteredOptions]}
            keyExtractor={(item) => item.value}
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="gap-2 p-4"
            ListEmptyComponent={
              <ThemedText variant="muted" className="py-6 text-center">
                {t('ui.select.empty')}
              </ThemedText>
            }
            renderItem={({ item }) => {
              const isSelected = item.value === value;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected, disabled: Boolean(item.disabled) }}
                  disabled={item.disabled}
                  onPress={() => handleSelect(item.value)}
                  className={cn(
                    'min-h-11 flex-row items-center justify-between gap-3 rounded-xl border px-4 py-3',
                    isSelected ? 'border-primary bg-secondary' : 'border-border bg-card',
                    item.disabled && 'opacity-45',
                  )}
                  style={{ borderCurve: 'continuous' }}
                >
                  <View className="flex-1 gap-0.5">
                    <ThemedText variant="headline" className="text-sm">
                      {item.label}
                    </ThemedText>
                    {item.description ? <ThemedText variant="caption">{item.description}</ThemedText> : null}
                  </View>
                  {isSelected ? <ThemedText className="text-sm font-bold text-primary">✓</ThemedText> : null}
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}
