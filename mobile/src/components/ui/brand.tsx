import { Image, StyleSheet, View, type ImageStyle } from 'react-native';

const icons = {
  calendar: require('../../../assets/images/ui/calendar.png'),
  scissors: require('../../../assets/images/ui/scissors.png'),
  coins: require('../../../assets/images/ui/coins.png'),
  shop: require('../../../assets/images/ui/shop.png'),
  userplus: require('../../../assets/images/ui/userplus.png'),
  users: require('../../../assets/images/ui/users.png'),
  shield: require('../../../assets/images/ui/shield.png'),
  eye: require('../../../assets/images/ui/eye.png'),
  lock: require('../../../assets/images/ui/lock.png'),
  grid: require('../../../assets/images/ui/grid.png'),
  clock: require('../../../assets/images/ui/clock.png'),
  settings: require('../../../assets/images/ui/settings.png'),
  crown: require('../../../assets/images/ui/crown.png'),
  sparkle: require('../../../assets/images/ui/sparkle.png'),
};
export type BrandIconName = keyof typeof icons;
const tones = {
  navy: ['#E6EBFB', '#253868'],
  terra: ['#FBE5DC', '#AB4524'],
  green: ['#E2F3E9', '#247748'],
  violet: ['#EEE6FB', '#7150A3'],
} as const;

export function BrandIcon({ name, color = '#17213b', size = 20 }: {
  name: BrandIconName; color?: string; size?: number;
}) {
  return <Image accessible={false} source={icons[name]} style={{ width: size, height: size, tintColor: color }} />;
}

export function IconTile({ name, tone = 'navy', size = 44 }: {
  name: BrandIconName; tone?: keyof typeof tones; size?: number;
}) {
  const [backgroundColor, color] = tones[tone];
  return (
    <View style={{ width: size, height: size, backgroundColor, borderRadius: size / 3, alignItems: 'center', justifyContent: 'center' }}>
      <BrandIcon name={name} color={color} size={size * 0.53} />
    </View>
  );
}

export function BrandLogo({ width = 176 }: { width?: number }) {
  return <Image accessibilityLabel="GoMeCoiffer" accessible source={require('../../../../brand/logo/png/gomecoiffer-horizontal.png')}
    resizeMode="contain" style={{ width, height: width * 477 / 1600 }} />;
}

export function BrandBackdrop() {
  return <View pointerEvents="none" aria-hidden style={StyleSheet.absoluteFill}>
    <Image accessible={false} source={require('../../../assets/images/pastel-waves.jpg')} resizeMode="stretch" style={styles.backdrop} />
  </View>;
}

const styles = StyleSheet.create({ backdrop: { width: '100%', height: '100%' } satisfies ImageStyle });
