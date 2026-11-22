import { t } from '@gomecoiffer/client-core';
import {
  CITIES,
  CreateOrganizationSchema,
  SalonTypeSchema,
  type City,
  type CreateOrganization,
  type SalonType,
} from '@gomecoiffer/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { PhoneField } from '@/components/forms/phone-field';
import { Button } from '@/components/ui/button';
import { InlineAlert } from '@/components/ui/inline-alert';
import { SelectField, type SelectOption } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';

const SALON_TYPE_OPTIONS: ReadonlyArray<SelectOption<SalonType>> = SalonTypeSchema.options.map((value) => ({
  value,
  label: t(`salons.type.${value}`),
}));

const CITY_OPTIONS: ReadonlyArray<SelectOption<City>> = CITIES.map((city) => ({
  value: city,
  label: city,
}));

export type SalonFormProps = {
  readonly submitLabel: string;
  readonly isSubmitting?: boolean;
  readonly isOnline?: boolean;
  readonly errorMessage?: string | null;
  readonly onSubmit: (values: CreateOrganization) => void | Promise<void>;
};

export function SalonForm({
  submitLabel,
  isSubmitting = false,
  isOnline = true,
  errorMessage = null,
  onSubmit,
}: SalonFormProps) {
  const { control, handleSubmit } = useForm<CreateOrganization>({
    resolver: zodResolver(CreateOrganizationSchema),
    defaultValues: {
      name: '',
      district: '',
      landmark: '',
      phone: '',
    },
  });

  const submitForm = handleSubmit((values) => {
    if (isSubmitting || !isOnline) return;
    return onSubmit(values);
  });

  return (
    <View className="gap-4">
      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <TextField
            label={t('salons.form.nameLabel')}
            placeholder={t('salons.form.namePlaceholder')}
            leadingIcon="shop"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            editable={!isSubmitting}
            autoCapitalize="words"
          />
        )}
      />

      <Controller
        control={control}
        name="type"
        render={({ field, fieldState }) => (
          <SelectField
            label={t('salons.form.typeLabel')}
            leadingIcon="scissors"
            value={field.value}
            options={SALON_TYPE_OPTIONS}
            onChange={field.onChange}
            error={fieldState.error?.message}
            disabled={isSubmitting}
          />
        )}
      />

      <Controller
        control={control}
        name="city"
        render={({ field, fieldState }) => (
          <SelectField
            label={t('salons.form.cityLabel')}
            leadingIcon="grid"
            value={field.value}
            options={CITY_OPTIONS}
            searchable
            onChange={field.onChange}
            error={fieldState.error?.message}
            disabled={isSubmitting}
          />
        )}
      />

      <Controller
        control={control}
        name="district"
        render={({ field, fieldState }) => (
          <TextField
            label={t('salons.form.districtLabel')}
            placeholder={t('salons.form.districtPlaceholder')}
            leadingIcon="shop"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            editable={!isSubmitting}
            autoCapitalize="words"
          />
        )}
      />

      <Controller
        control={control}
        name="landmark"
        render={({ field, fieldState }) => (
          <TextField
            label={t('salons.form.landmarkLabel')}
            placeholder={t('salons.form.landmarkPlaceholder')}
            hint={t('salons.form.landmarkHint')}
            leadingIcon="sparkle"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            editable={!isSubmitting}
          />
        )}
      />

      <Controller
        control={control}
        name="phone"
        render={({ field, fieldState }) => (
          <PhoneField
            label={t('salons.form.phoneLabel')}
            placeholder={t('salons.form.phonePlaceholder')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            editable={!isSubmitting}
          />
        )}
      />

      {errorMessage ? <InlineAlert variant="error" message={errorMessage} /> : null}
      {!isOnline ? <InlineAlert variant="warning" message={t('common.offlineActionHint')} /> : null}

      <Button
        icon="shop"
        title={submitLabel}
        loading={isSubmitting}
        disabled={!isOnline}
        onPress={() => void submitForm()}
      />
    </View>
  );
}
