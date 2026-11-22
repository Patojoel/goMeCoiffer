import { Link, Slot, usePathname, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Badge } from '@/components/ui/badge';
import { BrandBackdrop, BrandLogo } from '@/components/ui/brand';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { ThemedText } from '@/components/ui/themed-text';
import { cn } from '@/lib/ui/cn';

export type WebTabItem = {
  readonly label: string;
  readonly href: Href;
  readonly matchPath: string;
};

export type WebTabNavProps = {
  readonly spaceLabel: string;
  readonly items: readonly WebTabItem[];
};

export function WebTabNav({ spaceLabel, items }: WebTabNavProps) {
  const pathname = usePathname();

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
      <BrandBackdrop />
      <View
        className="border-b border-white/90 bg-card/85 px-4 py-3"
        style={{ boxShadow: '0 6px 22px rgba(31, 41, 80, 0.06)' }}
      >
        <View className="mx-auto w-full max-w-5xl flex-row flex-wrap items-center justify-between gap-3">
          <View className="flex-row items-center gap-3">
            <BrandLogo width={154} />
            <Badge variant="secondary" label={spaceLabel} />
          </View>
          <View
            role="tablist"
            className="max-w-full flex-row flex-wrap gap-1.5 rounded-2xl border border-white/90 bg-secondary/70 p-1"
          >
            {items.map((item) => {
              const active = pathname === item.matchPath;
              return (
                <Link key={item.matchPath} href={item.href} asChild>
                  <Pressable
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    className={cn(
                      'min-h-11 justify-center rounded-xl px-4 py-2',
                      active ? 'bg-primary' : 'bg-card/75',
                    )}
                    style={{
                      borderCurve: 'continuous',
                      boxShadow: active ? '0 6px 14px rgba(23, 33, 59, 0.16)' : undefined,
                    }}
                  >
                    <ThemedText
                      className={cn(
                        'text-xs font-bold',
                        active ? 'text-primary-foreground' : 'text-secondary-foreground',
                      )}
                    >
                      {item.label}
                    </ThemedText>
                  </Pressable>
                </Link>
              );
            })}
          </View>
        </View>
      </View>
      <View className="mx-auto w-full max-w-5xl flex-1">
        <Slot />
      </View>
    </SafeAreaView>
  );
}
