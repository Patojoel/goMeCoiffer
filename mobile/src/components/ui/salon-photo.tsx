import { useState } from 'react';
import { Image } from 'react-native';

const photos = {
  salon: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=850&q=85',
  barber: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=850&q=85',
};

export function SalonPhoto({ scene }: { readonly scene: keyof typeof photos }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <Image
      accessible={false}
      source={{ uri: photos[scene] }}
      style={{ width: '100%', aspectRatio: 2.2, borderRadius: 20 }}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}
