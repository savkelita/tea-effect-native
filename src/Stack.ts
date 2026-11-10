/**
 * Stack connects a stack of screens that lives in the model to React Native.
 *
 * The model holds the screens and the view draws them, for example with
 * `react-native-screens`. Two things reach that model from outside its `update`:
 * a screen asking for a route to be opened, and Android's back button. `make`
 * creates a typed channel for the first, and `onHardwareBack` subscribes to the
 * second.
 *
 * @since 0.1.0
 */
import { Effect, Stream } from 'effect'
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
