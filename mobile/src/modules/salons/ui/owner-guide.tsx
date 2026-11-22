import { formatWeeklyScheduleSummary, selectActiveSalon, type WeeklySchedule } from '@gomecoiffer/client-core';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Platform, ScrollView } from 'react-native';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-field';
import { ThemedText } from '@/components/ui/themed-text';
import { useAppSelector } from '@/lib/store/hooks';
import { InviteCollaboratorView } from '@/modules/team/ui/invite/invite-collaborator-view';
import { WeeklyScheduleEditor } from './hours/weekly-schedule-editor';
import { OwnerStepHero } from './owner-step-hero';

const day = z.object({
  day: z.enum(['MON','TUE','WED','THU','FRI','SAT','SUN']), isOpen: z.boolean(),
  openTime: z.string(), closeTime: z.string(), breakStart: z.string().nullable(), breakEnd: z.string().nullable(),
});
const schema = z.object({
  step: z.union([z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
  hours: z.array(day).length(7).optional(), service: z.string(), price: z.string(), minutes: z.string(),
});
type Draft = z.infer<typeof schema>;
const initial: Draft = { step: 3, service: '', price: '', minutes: '' };

function Guide({ id, name, location }: { id: string; name: string; location: string }) {
  const key = 'gmc.owner-guide.' + id;
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(initial);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [invite, setInvite] = useState(false);
  useEffect(() => {
    let active = true;
    async function load() {
      const raw = Platform.OS === 'web' ? localStorage.getItem(key) : await SecureStore.getItemAsync(key);
      if (raw && active) setDraft(schema.parse(JSON.parse(raw)));
    }
    load().catch(() => { if (active) setError('Le brouillon local n’a pas pu être chargé.'); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [key]);

  async function move(step: Draft['step'], hours?: WeeklySchedule) {
    const next = { ...draft, step, ...(hours ? { hours: [...hours] } : {}) };
    try {
      const value = JSON.stringify(next);
      if (Platform.OS === 'web') localStorage.setItem(key, value);
      else await SecureStore.setItemAsync(key, value);
      setError('');
      setDraft(next);
    } catch { setError('Enregistrement impossible sur cet appareil. Réessayez.'); }
  }
  if (!ready) return <ThemedText>Chargement du parcours…</ThemedText>;
  if (draft.step === 3) return <>
    {error ? <ThemedText variant="error">{error}</ThemedText> : null}
    <WeeklyScheduleEditor guided initialSchedule={draft.hours} onApply={(hours) => void move(4, hours)} />
  </>;
  const valid = draft.service.trim().length >= 2 && /^\d{1,9}$/.test(draft.price) &&
    /^\d{1,4}$/.test(draft.minutes) && +draft.minutes > 0 && +draft.minutes <= 1440;
  const review = draft.step === 6;
  return (
    <ScrollView key={draft.step} keyboardShouldPersistTaps="handled" className="flex-1 bg-background"
      contentContainerClassName="mx-auto w-full max-w-2xl gap-4 px-5 pb-12">
      <OwnerStepHero step={draft.step}
        title={review ? 'Vérifiez votre fiche' : draft.step === 5 ? 'Votre équipe' : 'Votre première prestation'}
        hint={review ? 'Relisez les informations avant d’ouvrir votre tableau de bord.' : draft.step === 5 ?
          'Invitez un collaborateur ou continuez seul.' : 'Quel service souhaitez-vous proposer en premier ?'} />
      {draft.step === 4 && <Card>
        <TextField label="Nom de la prestation" placeholder="Ex. Tresses simples" value={draft.service} maxLength={80}
          onChangeText={(service) => setDraft({ ...draft, service })} />
        <TextField label="Prix en FCFA" keyboardType="number-pad" value={draft.price} maxLength={9}
          onChangeText={(price) => setDraft({ ...draft, price })} />
        <TextField label="Durée en minutes" keyboardType="number-pad" value={draft.minutes} maxLength={4}
          hint="Entre 1 et 1 440 minutes." onChangeText={(minutes) => setDraft({ ...draft, minutes })} />
      </Card>}
      {(review || (draft.step === 4 && valid)) && <Card>
        <ThemedText variant="headline">Aperçu de votre vitrine</ThemedText>
        <ThemedText variant="title">{name}</ThemedText>
        <ThemedText>{location}</ThemedText>
        <ThemedText>{draft.service.trim()} · {Number(draft.price).toLocaleString('fr-FR')} FCFA · {draft.minutes} min</ThemedText>
        {draft.hours && <ThemedText>{formatWeeklyScheduleSummary(draft.hours)}</ThemedText>}
        <ThemedText variant="muted">Horaires et prestation en brouillon sur cet appareil.</ThemedText>
      </Card>}
      {draft.step === 5 && <>
        <Button title={invite ? 'Masquer le formulaire' : 'Inviter un collaborateur'} variant="outline" onPress={() => setInvite(!invite)} />
        {invite && <InviteCollaboratorView />}
      </>}
      {error ? <ThemedText variant="error">{error}</ThemedText> : null}
      <Button title={review ? 'Ouvrir mon tableau de bord' : draft.step === 4 ? 'Configurer mon équipe' :
        invite ? 'Vérifier ma fiche' : 'Je travaille seul · vérifier ma fiche'}
        disabled={draft.step === 4 && !valid} onPress={() => review ? router.replace('/(salon)/(tabs)') : void move(draft.step === 4 ? 5 : 6)} />
      <Button title="Retour" variant="ghost" onPress={() => void move(review ? 5 : draft.step === 5 ? 4 : 3)} />
      {review && <Button title="Modifier les horaires" variant="outline" onPress={() => void move(3)} />}
    </ScrollView>
  );
}

export function OwnerGuide() {
  const salon = useAppSelector(selectActiveSalon);
  if (!salon || salon.role !== 'OWNER') return <ThemedText>Ouvrez un salon dont vous êtes propriétaire.</ThemedText>;
  return <Guide key={salon.id} id={salon.id} name={salon.name} location={salon.district + ', ' + salon.city} />;
}
