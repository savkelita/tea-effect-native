/**
 * Linking connects the model to links: the one that started the application, the ones that arrive while it
 * runs, and opening a link in another application.
 *
 * A link reaches the application only when its scheme is registered for it - `scheme` in `app.json` with
 * Expo, or an intent filter and a URL type in the native projects. The model reads the link that started
 * it with `getInitialUrl` and subscribes to the rest with `onUrl`; both give the link as it came, and the
 * application decides which screen it means. `openUrl` hands a link to the application registered for it,
 * such as the browser for `https:` or the dialer for `tel:`.
 *
 * @since 0.4.0
 */
import { Effect, Option, Stream } from 'effect'
import { Linking as NativeLinking } from 'react-native'
import type * as Cmd from 'tea-effect/Cmd'
import * as Sub from 'tea-effect/Sub'

// -------------------------------------------------------------------------------------
// model
// -------------------------------------------------------------------------------------

/**
 * Why a link task failed: reading the link that started the application, or opening a link, which fails
 * when no application on the device can open it.
 *
 * @since 0.4.0
 * @category Model
 */
export type LinkingError =
  | { readonly _tag: 'InitialUrlFailed'; readonly error: unknown }
  | { readonly _tag: 'OpenFailed'; readonly url: string; readonly error: unknown }

// -------------------------------------------------------------------------------------
// constructors
// -------------------------------------------------------------------------------------

/**
 * @since 0.4.0
 * @category Constructors
 */
export const initialUrlFailed = (error: unknown): LinkingError => ({ _tag: 'InitialUrlFailed', error })

/**
 * @since 0.4.0
 * @category Constructors
 */
export const openFailed = (url: string, error: unknown): LinkingError => ({ _tag: 'OpenFailed', url, error })

// -------------------------------------------------------------------------------------
// tasks
// -------------------------------------------------------------------------------------

/**
 * The link that started the application, or `None` when it was opened without one, from the home screen
 * or the app switcher.
 *
 * A development build is itself started by a link, the one that points it at the development server, so
 * an application should recognize its own links and ignore the rest.
 *
 * @since 0.4.0
 * @category Tasks
 */
export const getInitialUrlTask: Effect.Effect<Option.Option<string>, LinkingError> = Effect.map(
  Effect.tryPromise({ try: () => NativeLinking.getInitialURL(), catch: initialUrlFailed }),
  url => Option.filter(Option.fromNullishOr(url), link => link !== ''),
)

/**
 * Opens `url` in the application registered for it. Fails with `OpenFailed` when there is none, for
 * example for a scheme that no installed application handles.
 *
 * @since 0.4.0
 * @category Tasks
 */
export const openUrlTask = (url: string): Effect.Effect<void, LinkingError> =>
  Effect.tryPromise({ try: () => NativeLinking.openURL(url), catch: error => openFailed(url, error) })

// -------------------------------------------------------------------------------------
// commands
// -------------------------------------------------------------------------------------

/**
 * `getInitialUrlTask` as a command, with `onSuccess` and `onError` handlers as in `Http.send`.
 *
 * @since 0.4.0
 * @category Commands
 */
export const getInitialUrl = <Msg>(handlers: {
  readonly onSuccess: (url: Option.Option<string>) => Msg
  readonly onError: (error: LinkingError) => Msg
}): Cmd.Cmd<Msg> =>
  Stream.fromEffect(Effect.match(getInitialUrlTask, { onSuccess: handlers.onSuccess, onFailure: handlers.onError }))

/**
 * `openUrlTask` as a command, with `onSuccess` and `onError` handlers as in `Http.send`.
 *
 * @since 0.4.0
 * @category Commands
 */
export const openUrl = <Msg>(
  url: string,
  handlers: {
    readonly onSuccess: () => Msg
    readonly onError: (error: LinkingError) => Msg
  },
): Cmd.Cmd<Msg> =>
  Stream.fromEffect(
    Effect.match(openUrlTask(url), { onSuccess: () => handlers.onSuccess(), onFailure: handlers.onError }),
  )

/**
 * `openUrlTask` as a command that produces no message, whether the link opens or not.
 *
 * @since 0.4.0
 * @category Commands
 */
export const openUrlIgnoreErrors = (url: string): Cmd.Cmd<never> =>
  Stream.fromEffectDrain(Effect.ignore(openUrlTask(url)))

// -------------------------------------------------------------------------------------
// subscriptions
// -------------------------------------------------------------------------------------

/**
 * Subscribes to links that arrive while the application runs, in the foreground or the background, and
 * turns each into `toMsg(url)`. The link that started the application does not arrive here; read it with
 * `getInitialUrl`.
 *
 * The key is fixed, since links come from one source, so while the model keeps the subscription the
 * runtime keeps the first `toMsg`; pass a message constructor, not a closure over the model.
 *
 * @since 0.4.0
 * @category Subscriptions
 */
export const onUrl = <Msg>(toMsg: (url: string) => Msg): Sub.Sub<Msg> =>
  Sub.fromCallback<Msg>(emit => {
    const subscription = NativeLinking.addEventListener('url', ({ url }) => emit(toMsg(url)))
    return () => subscription.remove()
  }, 'linking:url')
