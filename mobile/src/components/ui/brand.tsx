import type { ReactNode } from 'react';
import { Image, StyleSheet, View, type ImageStyle } from 'react-native';
import { cn } from '@/lib/ui/cn';
import { ThemedText } from './themed-text';

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
export type BrandTone = 'navy' | 'terra' | 'green' | 'violet';

const tones: Record<BrandTone, readonly [string, string]> = {
  navy: ['#E8ECFB', '#17213B'],
  terra: ['#FFEDE6', '#C8562D'],
  green: ['#E7F8E9', '#167C37'],
  violet: ['#EFE9FF', '#715BB6'],
};

export function BrandIcon({
  name,
  color = '#17213b',
  size = 20,
}: {
  readonly name: BrandIconName;
  readonly color?: string;
  readonly size?: number;
}) {
  return (
    <Image
      accessible={false}
      source={icons[name]}
      style={{ width: size, height: size, tintColor: color }}
    />
  );
}

export function IconTile({
  name,
  tone = 'navy',
  size = 44,
}: {
  readonly name: BrandIconName;
  readonly tone?: BrandTone;
  readonly size?: number;
}) {
  const [backgroundColor, color] = tones[tone];
  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor,
        borderRadius: Math.round(size / 3),
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 5px 13px rgba(58, 58, 99, 0.06)',
      }}
    >
      <BrandIcon name={name} color={color} size={Math.round(size * 0.5)} />
    </View>
  );
}

export function BrandLogo({ width = 176 }: { readonly width?: number }) {
  return (
    <Image
      accessibilityLabel="GoMeCoiffer"
      accessible
      source={require('../../../../brand/logo/png/gomecoiffer-horizontal.png')}
      resizeMode="contain"
      style={{ width, height: (width * 477) / 1600 }}
    />
  );
}

export function BrandBackdrop() {
  return (
    <View pointerEvents="none" aria-hidden style={StyleSheet.absoluteFill}>
      <Image
        accessible={false}
        source={require('../../../assets/images/pastel-waves.jpg')}
        resizeMode="cover"
        style={styles.backdrop}
      />
    </View>
  );
}

export function BrandTopBar({
  right,
  logoWidth = 160,
  className,
}: {
  readonly right?: ReactNode;
  readonly logoWidth?: number;
  readonly className?: string;
}) {
  return (
    <View className={cn('flex-row items-center justify-between gap-3', className)}>
      <BrandLogo width={logoWidth} />
      {right}
    </View>
  );
}

export function PageHero({
  icon,
  tone = 'terra',
  eyebrow,
  title,
  subtitle,
  right,
}: {
  readonly icon: BrandIconName;
  readonly tone?: BrandTone;
  readonly eyebrow?: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly right?: ReactNode;
}) {
  return (
    <View className="flex-row items-center gap-3.5 py-1">
      <IconTile name={icon} tone={tone} size={48} />
      <View className="flex-1 gap-0.5">
        {eyebrow ? (
          <ThemedText className="text-[10px] font-bold uppercase tracking-widest text-accent">
            {eyebrow}
          </ThemedText>
        ) : null}
        <ThemedText accessibilityRole="header" variant="title" className="text-xl">
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText variant="muted" className="text-xs leading-4">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function AvatarInitials({
  name,
  tone = 'navy',
  size = 40,
}: {
  readonly name: string;
  readonly tone?: BrandTone;
  readonly size?: number;
}) {
  const [backgroundColor, color] = tones[tone];
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'GM';

  return (
    <View
      accessible={false}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 3px 9px rgba(19, 32, 60, 0.1)',
      }}
    >
      <ThemedText style={{ color, fontSize: Math.round(size * 0.34), fontWeight: '700' }}>
        {initials}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { width: '100%', height: '100%', opacity: 0.92 } satisfies ImageStyle,
});
