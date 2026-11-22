import { Link, Slot, usePathname, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';
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
      <View className="border-b border-border bg-card px-4 py-3">
        <View className="mx-auto w-full max-w-3xl gap-3">
          <View className="flex-row items-center justify-between">
            <ThemedText variant="subtitle">{spaceLabel}</ThemedText>
          </View>
          <View role="tablist" className="flex-row flex-wrap gap-2">
            {items.map((item) => {
              const active = pathname === item.matchPath;
              return (
                <Link key={item.matchPath} href={item.href} asChild>
                  <Pressable
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    className={cn(
                      'min-h-11 justify-center rounded-xl px-4 py-2',
                      active ? 'bg-primary' : 'bg-secondary',
                    )}
                  >
                    <ThemedText
                      className={cn(
                        'text-sm font-semibold',
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
      <View className="mx-auto w-full max-w-3xl flex-1">
        <Slot />
      </View>
    </SafeAreaView>
  );
}
