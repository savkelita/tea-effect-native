/**
 * ScreenStack draws the screens of a `Stack.Screens` with `react-native-screens`.
 *
 * The model owns the stack and this component only draws it: one native screen per
 * entry, with the platform's push transition. It uses `react-native-screens`
 * directly - the layer React Navigation's native stack is built on - so the model
 * stays the only place that knows which screens are open.
 *
 * It is a module of its own, and the root `tea-effect-native` entry does not
 * re-export it, so an application without `react-native-screens` never loads it.
 *
 * @since 0.3.0
 */
import { createElement, type ReactNode } from 'react'
import { Platform, StyleSheet } from 'react-native'
import { ScreenStack as NativeScreenStack, ScreenStackItem } from 'react-native-screens'
import type { Entry, Screens } from './Stack'

// -------------------------------------------------------------------------------------
// model
// -------------------------------------------------------------------------------------

/**
 * What `ScreenStack` draws: the screens from the model, a function that draws one
 * of them, and what to do when the platform closes some on its own.
 *
 * `children` draws a screen together with whatever the application puts around it,
 * such as its header. `onDismissed` receives the key and the count as
 * `Stack.dismiss` takes them.
 *
 * @since 0.3.0
 * @category Model
 */
export type ScreenStackProps<Screen> = {
  readonly screens: Screens<Screen>
  readonly children: (entry: Entry<Screen>, index: number) => ReactNode
  readonly onDismissed: (key: number, count: number) => void
}

// -------------------------------------------------------------------------------------
// components
// -------------------------------------------------------------------------------------

const styles = StyleSheet.create({
  stack: { flex: 1 },
})

/**
 * Draws every entry as a native screen, the top one in front.
 *
 * Each screen gets what React Navigation's native stack gives it, and what is easy
 * to miss without it:
 *
 * - `style={StyleSheet.absoluteFill}` and `activityState={2}`. Without them Fabric
 *   lays the screens out one below the other while natively they all start at the
 *   top, so a `Pressable` on a pushed screen measures itself a screen lower and
 *   cancels the press as soon as a finger moves. `adb shell input tap` sends no
 *   move and hides it.
 * - The native header is hidden, and the application draws its own in `children`.
 * - The iOS swipe back is on for every screen but the root. It closes the screen
 *   natively and arrives through `onDismissed`, for `Stack.dismiss`.
 * - Android's back button does not close a screen natively
 *   (`nativeBackButtonDismissalEnabled={false}`): it reaches the model through
 *   `Stack.onBack`, and the model decides.
 *
 * @since 0.3.0
 * @category Components
 */
export const ScreenStack = <Screen>({ screens, children, onDismissed }: ScreenStackProps<Screen>): ReactNode =>
  createElement(
    NativeScreenStack,
    { style: styles.stack },
    screens.entries.map((entry, index) =>
      createElement(
        ScreenStackItem,
        {
          key: entry.key,
          screenId: String(entry.key),
          activityState: 2,
          style: StyleSheet.absoluteFill,
          headerConfig: { hidden: true },
          gestureEnabled: Platform.OS === 'ios' && index > 0,
          nativeBackButtonDismissalEnabled: false,
          onDismissed: event => onDismissed(entry.key, event.nativeEvent.dismissCount),
        },
        children(entry, index),
      ),
    ),
  )
