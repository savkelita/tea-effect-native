import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingHorizontal: 8,
  },
  title: { flex: 1, paddingHorizontal: 12, fontSize: 18, fontWeight: '600', color: '#242424' },
  content: { flex: 1 },
  button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 4 },
  pressed: { backgroundColor: '#F0F0F0' },
  buttonText: { fontSize: 16, color: '#0F6CBD' },
})

export const Button = ({ label, onPress }: { readonly label: string; readonly onPress: () => void }) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    style={({ pressed }) => [styles.button, pressed && styles.pressed]}
  >
    <Text style={styles.buttonText}>{label}</Text>
  </Pressable>
)

export const Layout = ({
  title,
  onBack,
  children,
}: {
  readonly title: string
  readonly onBack: (() => void) | undefined
  readonly children: ReactNode
}) => (
  <SafeAreaView style={styles.safe}>
    <View style={styles.header}>
      {onBack === undefined ? null : <Button label="Back" onPress={onBack} />}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
    </View>
    <View style={styles.content}>{children}</View>
  </SafeAreaView>
)
