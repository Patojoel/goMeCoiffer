import {
  TIME_SLOTS_30MIN,
  WEEK_DAY_LABELS,
  applyHoursToWeekdays,
  createDefaultWeeklySchedule,
  formatWeeklyScheduleSummary,
  t,
  updateDaySchedule,
  validateDaySchedule,
  validateWeeklySchedule,
  type DaySchedule,
  type WeekDayKey,
  type WeeklySchedule,
} from '@gomecoiffer/client-core';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { InlineAlert } from '@/components/ui/inline-alert';
import { SelectField, type SelectOption } from '@/components/ui/select-field';
import { SwitchRow } from '@/components/ui/switch-row';
import { ThemedText } from '@/components/ui/themed-text';

const TIME_SLOT_OPTIONS: ReadonlyArray<SelectOption<string>> = TIME_SLOTS_30MIN.map((slot) => ({
  value: slot,
  label: slot,
}));

const MON_SAT_DAYS: readonly WeekDayKey[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MON_FRI_DAYS: readonly WeekDayKey[] = ['MON', 'TUE', 'WED', 'THU', 'FRI'];

const DEFAULT_OPEN_TEMPLATE: Omit<DaySchedule, 'day'> = {
  isOpen: true,
  openTime: '08:00',
  closeTime: '18:00',
  breakStart: null,
  breakEnd: null,
};

const CLOSED_TEMPLATE: Omit<DaySchedule, 'day'> = {
  isOpen: false,
  openTime: '08:00',
  closeTime: '18:00',
  breakStart: null,
  breakEnd: null,
};

export type WeeklyScheduleEditorProps = {
  readonly initialSchedule?: WeeklySchedule;
  readonly onApply?: (schedule: WeeklySchedule) => void;
};

type DayScheduleCardProps = {
  readonly item: DaySchedule;
  readonly errorMessage?: string;
  readonly onUpdate: (patch: Partial<Omit<DaySchedule, 'day'>>) => void;
};

function DayScheduleCard({ item, errorMessage, onUpdate }: DayScheduleCardProps) {
  const hasBreak = Boolean(item.breakStart || item.breakEnd);

  return (
    <Card testID={`schedule-day-${item.day}`}>
      <View className="flex-row items-center justify-between gap-2">
        <CardTitle>{WEEK_DAY_LABELS[item.day].full}</CardTitle>
        <Badge
          variant={item.isOpen ? 'success' : 'secondary'}
          label={item.isOpen ? t('salons.hours.openLabel') : t('salons.hours.closedLabel')}
        />
      </View>

      <SwitchRow
        label={t('salons.hours.openLabel')}
        value={item.isOpen}
        onValueChange={(isOpen) => onUpdate({ isOpen })}
      />

      {item.isOpen ? (
        <View className="gap-3">
          <SelectField
            label={t('salons.hours.startLabel')}
            value={item.openTime}
            options={TIME_SLOT_OPTIONS}
            searchable
            onChange={(openTime) => onUpdate({ openTime })}
          />
          <SelectField
            label={t('salons.hours.endLabel')}
            value={item.closeTime}
            options={TIME_SLOT_OPTIONS}
            searchable
            onChange={(closeTime) => onUpdate({ closeTime })}
          />
          <SwitchRow
            label={t('salons.hours.breakToggle')}
            value={hasBreak}
            onValueChange={(enabled) =>
              onUpdate(
                enabled
                  ? { breakStart: '12:00', breakEnd: '13:00' }
                  : { breakStart: null, breakEnd: null },
              )
            }
          />
          {hasBreak ? (
            <View className="gap-3">
              <SelectField
                label={t('salons.hours.breakStart')}
                value={item.breakStart}
                options={TIME_SLOT_OPTIONS}
                searchable
                onChange={(breakStart) => onUpdate({ breakStart })}
              />
              <SelectField
                label={t('salons.hours.breakEnd')}
                value={item.breakEnd}
                options={TIME_SLOT_OPTIONS}
                searchable
                onChange={(breakEnd) => onUpdate({ breakEnd })}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {errorMessage ? (
        <ThemedText variant="error" accessibilityRole="alert" className="text-sm">
          {errorMessage}
        </ThemedText>
      ) : null}
    </Card>
  );
}

export function WeeklyScheduleEditor({ initialSchedule, onApply }: WeeklyScheduleEditorProps) {
  const [schedule, setSchedule] = useState<WeeklySchedule>(
    () => initialSchedule ?? createDefaultWeeklySchedule(),
  );
  const [isConfirmed, setIsConfirmed] = useState(false);

  const validationErrors = validateWeeklySchedule(schedule);
  const errorByDay = new Map(validationErrors.map((err) => [err.day, err.message]));
  const hasErrors = validationErrors.length > 0;
  const summary = formatWeeklyScheduleSummary(schedule);

  const handleUpdateDay = (day: WeekDayKey, patch: Partial<Omit<DaySchedule, 'day'>>) => {
    setSchedule((prev) => updateDaySchedule(prev, day, patch));
    setIsConfirmed(false);
  };

  const applyPreset = (openDays: readonly WeekDayKey[], closedDays: readonly WeekDayKey[]) => {
    const monday = schedule[0];
    const mondayValidOpen = monday && monday.isOpen && validateDaySchedule(monday) === null;
    const openTemplate = mondayValidOpen
      ? {
          isOpen: true,
          openTime: monday.openTime,
          closeTime: monday.closeTime,
          breakStart: monday.breakStart,
          breakEnd: monday.breakEnd,
        }
      : DEFAULT_OPEN_TEMPLATE;

    setSchedule((prev) => {
      const withOpen = applyHoursToWeekdays(prev, openTemplate, openDays);
      return applyHoursToWeekdays(withOpen, CLOSED_TEMPLATE, closedDays);
    });
    setIsConfirmed(false);
  };

  const handleApply = () => {
    if (hasErrors) return;
    setIsConfirmed(true);
    onApply?.(schedule);
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        className="flex-1"
        contentContainerClassName="gap-4 p-4"
      >
        <InlineAlert variant="info" message={t('salons.hours.draftNotice')} />

        <Card>
          <CardTitle>{t('salons.hours.title')}</CardTitle>
          <CardDescription>{t('salons.hours.subtitle')}</CardDescription>
          <ThemedText variant="headline">{summary}</ThemedText>
          <View className="flex-row flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              title={t('salons.hours.presetMonSat')}
              onPress={() => applyPreset(MON_SAT_DAYS, ['SUN'])}
            />
            <Button
              variant="outline"
              size="sm"
              title={t('salons.hours.presetMonFri')}
              onPress={() => applyPreset(MON_FRI_DAYS, ['SAT', 'SUN'])}
            />
          </View>
        </Card>

        {schedule.map((item) => (
          <DayScheduleCard
            key={item.day}
            item={item}
            errorMessage={errorByDay.get(item.day)}
            onUpdate={(patch) => handleUpdateDay(item.day, patch)}
          />
        ))}

        {isConfirmed && !hasErrors ? (
          <InlineAlert variant="success" message={t('common.confirm')} />
        ) : null}

        <Button
          title={t('salons.hours.saveAction')}
          disabled={hasErrors}
          onPress={handleApply}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
