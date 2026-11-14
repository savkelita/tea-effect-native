/**
 * Stack keeps a stack of screens in the model and connects it to React Native.
 *
 * The model holds the screens as `Screens`: entries under keys that are never
 * reused, changed only through the functions here, so a message for a screen that
 * was closed meanwhile finds nothing. The view draws them, with
 * `tea-effect-native/ScreenStack` over `react-native-screens` or in any other way.
 * Two things reach the model from outside its `update`: a screen asking for a
 * route to be opened, and Android's back button. `make` creates a typed channel
 * for the first, and `onBack` subscribes to the second.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Option, Stream } from 'effect'
import { BackHandler } from 'react-native'
import type * as Cmd from 'tea-effect/Cmd'
import * as Sub from 'tea-effect/Sub'

// -------------------------------------------------------------------------------------
// model
// -------------------------------------------------------------------------------------

/**
 * A typed channel from screens to the model that owns the stack. A screen returns
 * `push(route)` from its `update`; the owner subscribes with `onPush` and opens
 * the route in its own `update`.
 *
 * @since 0.1.0
 * @category Model
 */
export type Stack<Route> = {
  readonly push: (route: Route) => Cmd.Cmd<never>
  readonly onPush: <Msg>(toMsg: (route: Route) => Msg) => Sub.Sub<Msg>
}

/**
 * One screen on the stack, under the key it got when it was pushed.
 *
 * @since 0.3.0
 * @category Model
 */
export type Entry<Screen> = {
  readonly key: number
  readonly screen: Screen
}

/**
 * The screens on the stack, from the root to the top. The root is always there,
 * and a key is never given twice, so it names one screen for as long as the stack
 * lives.
 *
 * @since 0.3.0
 * @category Model
 */
export type Screens<Screen> = {
  readonly entries: readonly [Entry<Screen>, ...Array<Entry<Screen>>]
  readonly nextKey: number
}

// -------------------------------------------------------------------------------------
// constructors
// -------------------------------------------------------------------------------------

let stackCounter = 0

/**
 * Creates the channel for one route type, usually once per application.
 *
 * `push` hands the route to every `onPush` subscription running at that moment
 * and produces no message of its own, so a screen can return it without knowing
 * who listens. A route pushed while nothing listens is dropped.
 *
 * Each channel gets its own subscription key, so the runtime tells channels apart:
 * a model can listen to several at once, or stop listening to one and start on
 * another. The key does not depend on `toMsg`, so while the model keeps listening
 * to a channel the runtime keeps the first `toMsg`; pass a message constructor,
 * not a closure over the model.
 *
 * @since 0.1.0
 * @category Constructors
 */
export const make = <Route>(): Stack<Route> => {
  const key = `stack:${stackCounter++}:push`
  const listeners = new Set<(route: Route) => void>()
  return {
    push: route => Stream.fromEffectDrain(Effect.sync(() => listeners.forEach(listener => listener(route)))),
    onPush: toMsg =>
      Sub.fromCallback(emit => {
        const listener = (route: Route) => emit(toMsg(route))
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      }, key),
  }
}

/**
 * Starts a stack with its root screen, under key 0.
 *
 * @since 0.3.0
 * @category Constructors
 */
export const of = <Screen>(screen: Screen): Screens<Screen> => ({ entries: [{ key: 0, screen }], nextKey: 1 })

// -------------------------------------------------------------------------------------
// combinators
// -------------------------------------------------------------------------------------

/**
 * Puts a screen on top, under a new key. `top` gives the key, to map the
 * screen's first command with it.
 *
 * @since 0.3.0
 * @category Combinators
 */
export const push = <Screen>(screens: Screens<Screen>, screen: Screen): Screens<Screen> => ({
  entries: [...screens.entries, { key: screens.nextKey, screen }],
  nextKey: screens.nextKey + 1,
})

/**
 * Takes the top screen off. The root stays, so on the root the stack comes back
 * as it was.
 *
 * @since 0.3.0
 * @category Combinators
 */
export const pop = <Screen>(screens: Screens<Screen>): Screens<Screen> => {
  const [root, ...rest] = screens.entries
  return rest.length === 0 ? screens : { ...screens, entries: [root, ...rest.slice(0, -1)] }
}

/**
 * Takes off what the platform has already closed: `count` screens, from the one
 * under `key` down, as `react-native-screens` reports an iOS swipe back. The root
 * stays, and a key that is not on the stack changes nothing.
 *
 * @since 0.3.0
 * @category Combinators
 */
export const dismiss = <Screen>(screens: Screens<Screen>, key: number, count: number): Screens<Screen> => {
  const index = screens.entries.findIndex(entry => entry.key === key)
  if (index < 1) return screens
  const [root, ...rest] = screens.entries
  return { ...screens, entries: [root, ...rest.slice(0, Math.max(0, index - count))] }
}

/**
 * Replaces the screen under `key`, usually with what its `update` returned. A key
 * that is not on the stack - a screen closed while its message was on the way -
 * changes nothing.
 *
 * @since 0.3.0
 * @category Combinators
 */
export const set = <Screen>(screens: Screens<Screen>, key: number, screen: Screen): Screens<Screen> => {
  if (!screens.entries.some(entry => entry.key === key)) return screens
  const [root, ...rest] = screens.entries
  const replace = (entry: Entry<Screen>): Entry<Screen> => (entry.key === key ? { key, screen } : entry)
  return { ...screens, entries: [replace(root), ...rest.map(replace)] }
}

/**
 * Remembers one message wrapper per key, for mapping a screen's commands and view.
 *
 * `Html.map` keeps the mapped dispatch per mapping function, and a screen's
 * callbacks are made from that dispatch. A wrapper made anew on every render gives
 * the screen a new dispatch each time, so every `memo` under it draws again. One
 * wrapper per key keeps the dispatch for as long as the screen is on the stack.
 * Keys are never given twice, so a remembered wrapper never goes stale; each
 * pushed screen adds one small function. Make it once, at module level, from a
 * constructor such as `screen = (key) => (msg) => ...`, and use it both for
 * `Cmd.map(screenMsg(key))` in `update` and `Html.map(screenMsg(entry.key))` in
 * the view.
 *
 * @since 0.3.0
 * @category Combinators
 */
export const keyed = <ScreenMsg, Msg>(
  toMsg: (key: number) => (msg: ScreenMsg) => Msg,
): ((key: number) => (msg: ScreenMsg) => Msg) => {
  const wrappers = new Map<number, (msg: ScreenMsg) => Msg>()
  return key => {
    const known = wrappers.get(key)
    if (known !== undefined) return known
    const wrapper = toMsg(key)
    wrappers.set(key, wrapper)
    return wrapper
  }
}

// -------------------------------------------------------------------------------------
// getters
// -------------------------------------------------------------------------------------

/**
 * The screen under `key`, or `None` once it has left the stack.
 *
 * @since 0.3.0
 * @category Getters
 */
export const get = <Screen>(screens: Screens<Screen>, key: number): Option.Option<Screen> =>
  Option.map(
    Arr.findFirst(screens.entries, entry => entry.key === key),
    entry => entry.screen,
  )

/**
 * The screen on top, the one the user sees.
 *
 * @since 0.3.0
 * @category Getters
 */
export const top = <Screen>(screens: Screens<Screen>): Entry<Screen> => Arr.lastNonEmpty(screens.entries)

/**
 * Whether there is a screen above the root to go back from.
 *
 * @since 0.3.0
 * @category Getters
 */
export const canGoBack = <Screen>(screens: Screens<Screen>): boolean => screens.entries.length > 1

// -------------------------------------------------------------------------------------
// subscriptions
// -------------------------------------------------------------------------------------

/**
 * Subscribes to Android's back button and turns every press into `toMsg()`.
 *
 * The press is consumed, so React Native's default - leaving the app - does not
 * run. Subscribe only while there is a screen to go back from; without the
 * subscription the press is handled as usual. iOS has no back button, so nothing
 * arrives there.
 *
 * The key is fixed, since there is one back button, so while the model keeps the
 * subscription the runtime keeps the first `toMsg`; pass a message constructor,
 * not a closure over the model.
 *
 * @since 0.1.0
 * @category Subscriptions
 */
export const onHardwareBack = <Msg>(toMsg: () => Msg): Sub.Sub<Msg> =>
  Sub.fromCallback<Msg>(emit => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      emit(toMsg())
      return true
    })
    return () => subscription.remove()
  }, 'stack:hardware-back')

/**
 * Subscribes to Android's back button while there is a screen to go back from,
 * with `onHardwareBack`. On the root there is no subscription, so the press does
 * what it does without the app: it leaves.
 *
 * @since 0.3.0
 * @category Subscriptions
 */
export const onBack = <Screen, Msg>(screens: Screens<Screen>, toMsg: () => Msg): Sub.Sub<Msg> =>
  canGoBack(screens) ? onHardwareBack(toMsg) : Sub.none
