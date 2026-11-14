/**
 * AppState tells the model when the application comes to the foreground and when it leaves it.
 *
 * A browser tab reports that through `document.visibilityState`; an application on a phone through React
 * Native's `AppState`. While an application is in the background its JavaScript may be paused, so timers
 * stop and nothing is redrawn. The change back to `active` is the moment to refresh what may have gone
 * stale meanwhile, such as data from a server or a session's expiry.
 *
 * @since 0.4.0
 */
import { AppState as NativeAppState, type AppStateStatus } from 'react-native'
import * as Sub from 'tea-effect/Sub'

// -------------------------------------------------------------------------------------
// model
// -------------------------------------------------------------------------------------

/**
 * The application's state: `active` in the foreground, `background` behind another application or the
 * home screen, and on iOS `inactive` in between, such as in the app switcher or during a call. `unknown`
 * and `extension` are iOS states for an application that has not started yet and for app extensions.
 *
 * @since 0.4.0
 * @category Model
 */
export type Status = AppStateStatus

// -------------------------------------------------------------------------------------
// subscriptions
// -------------------------------------------------------------------------------------

/**
 * Subscribes to the application's state and turns every change into `toMsg(status)`.
 *
 * Only changes arrive, not the state at the start; an application the user opens starts `active`.
 *
 * The key is fixed, since an application has one state, so while the model keeps the subscription the
 * runtime keeps the first `toMsg`; pass a message constructor, not a closure over the model.
 *
 * @since 0.4.0
 * @category Subscriptions
 */
export const onChange = <Msg>(toMsg: (status: Status) => Msg): Sub.Sub<Msg> =>
  Sub.fromCallback<Msg>(emit => {
    const subscription = NativeAppState.addEventListener('change', status => emit(toMsg(status)))
    return () => subscription.remove()
  }, 'app-state:change')
