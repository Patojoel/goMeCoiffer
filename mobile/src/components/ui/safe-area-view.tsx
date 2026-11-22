import { useContext } from 'react';
import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { SafeAreaInsetsContext, type Edge } from 'react-native-safe-area-context';

export type SafeAreaViewProps = ViewProps & {
  readonly edges?: readonly Edge[];
  readonly className?: string;
};

const DEFAULT_EDGES: readonly Edge[] = ['top', 'right', 'bottom', 'left'];

export function SafeAreaView({ edges = DEFAULT_EDGES, style, ...props }: SafeAreaViewProps) {
  const insets = useContext(SafeAreaInsetsContext);

  let insetStyle: StyleProp<ViewStyle> = undefined;
  if (insets) {
    const edgeSet = new Set(edges);
    insetStyle = {
      ...(edgeSet.has('top') && insets.top > 0 ? { paddingTop: insets.top } : {}),
      ...(edgeSet.has('right') && insets.right > 0 ? { paddingRight: insets.right } : {}),
      ...(edgeSet.has('bottom') && insets.bottom > 0 ? { paddingBottom: insets.bottom } : {}),
      ...(edgeSet.has('left') && insets.left > 0 ? { paddingLeft: insets.left } : {}),
    };
  }

  return <View style={[insetStyle, style]} {...props} />;
}
