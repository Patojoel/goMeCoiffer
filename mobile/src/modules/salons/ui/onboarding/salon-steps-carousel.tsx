import { useMemo, useState } from 'react';
import { PanResponder, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ThemedText } from '@/components/ui/themed-text';

const slides = [
  {
    title: 'Créer votre compte',
    description: 'Inscrivez-vous avec votre numéro de téléphone et confirmez le code reçu par SMS.',
  },
  {
    title: 'Créer votre organisation et votre salon',
    description: 'Indiquez le nom commercial du premier salon, son activité, son adresse et son téléphone. Votre organisation prend le nom de ce salon.',
  },
  {
    title: 'Préparer vos horaires',
    description: 'Choisissez vos jours d’ouverture, les heures de fermeture et les pauses pour vérifier votre semaine type.',
  },
  {
    title: 'Accueillir votre équipe',
    description: 'Invitez vos collaborateurs et attribuez leur rôle. Vous travaillez seul ? Vous pouvez ouvrir directement votre tableau de bord à cette étape.',
  },
] as const;

export function SalonStepsCarousel() {
  const [index, setIndex] = useState(0);
  const swipe = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, { dx, dy }) => Math.abs(dx) > 16 && Math.abs(dx) > Math.abs(dy) * 1.5,
    onPanResponderRelease: (_, { dx }) => {
      if (Math.abs(dx) < 35) return;
      setIndex(current => Math.max(0, Math.min(slides.length - 1, current + (dx < 0 ? 1 : -1))));
    },
  }), []);
  const slide = slides[index]!;
  return (
    <Card className="bg-card">
      <View {...swipe.panHandlers} className="gap-2">
        <ThemedText variant="muted">Parcours propriétaire · {index + 1} sur {slides.length}</ThemedText>
        <View accessibilityLiveRegion="polite" className="gap-2">
          <ThemedText accessibilityRole="header" variant="title">{slide.title}</ThemedText>
          <ThemedText>{slide.description}</ThemedText>
        </View>
      </View>
      <View className="flex-row gap-1.5" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {slides.map((item, i) => <View key={item.title} className={i === index ? 'h-1 flex-1 rounded-full bg-accent' : 'h-1 flex-1 rounded-full bg-border'} />)}
      </View>
      <View className="flex-row flex-wrap gap-2">
        <Button size="sm" variant="outline" title="Précédent" disabled={!index} onPress={() => setIndex(i => Math.max(0, i - 1))} />
        <Button size="sm" title={index === slides.length - 1 ? 'Revoir le parcours' : 'Suivant'}
          onPress={() => setIndex(i => (i + 1) % slides.length)} />
      </View>
    </Card>
  );
}
