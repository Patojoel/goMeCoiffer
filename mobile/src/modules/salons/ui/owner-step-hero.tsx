import { ImageBackground, View } from 'react-native';
import { ThemedText } from '@/components/ui/themed-text';

const images = [
  require('../../../../assets/images/onboarding/onboarding-1.jpg'),
  require('../../../../assets/images/onboarding/onboarding-2.jpg'),
  require('../../../../assets/images/onboarding/onboarding-3.jpg'),
];

export function OwnerStepHero({ step, title, hint }: { step: number; title: string; hint: string }) {
  const image = step === 5 ? images[2] : step === 4 ? images[1] : images[0];
  return (
    <ImageBackground source={image} resizeMode="cover" className="-mx-5">
      <View className="min-h-52 justify-end gap-2 px-5 py-6" style={{ backgroundColor: 'rgba(12,20,34,0.66)' }}>
        <ThemedText className="font-semibold text-white">Étape {step} sur 6</ThemedText>
        <ThemedText accessibilityRole="header" className="text-3xl font-bold text-white">{title}</ThemedText>
        <ThemedText className="text-base leading-6 text-white">{hint}</ThemedText>
      </View>
    </ImageBackground>
  );
}
