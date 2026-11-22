import Stack from 'expo-router/stack';

export default function ClientLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="salon/[salonId]" options={{ headerShown: true, title: '' }} />
    </Stack>
  );
}
