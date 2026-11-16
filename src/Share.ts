/**
 * Share opens the platform's share sheet, where the user picks an application to send text or a link to,
 * and reports how the sheet closed.
 *
 * It is React Native's `Share.share` as a task and commands. The content and the options take React
 * Native's fields in one record, as `Http.request` does, and the handlers come last, as in `Linking`.
 *
 * The platforms send different parts of it. Android sends `message`, with `title` as its subject; it does
 * not send `url`, so put a link in the message. `dialogTitle` is Android's title for the sheet, though
 * Android 16 shows its own heading instead. iOS sends `message` and `url`, and reads `subject`,
 * `excludedActivityTypes`, `tintColor` and `anchor`.
 *
 * @since 0.5.0
 */
import { Effect, Option, Stream } from 'effect'
import { Share as NativeShare, type ShareContent, type ShareOptions } from 'react-native'
import type * as Cmd from 'tea-effect/Cmd'

// -------------------------------------------------------------------------------------
// model
// -------------------------------------------------------------------------------------

/**
 * What to share - `message`, `url` or both, and `title` - together with React Native's options for the
 * sheet: `dialogTitle`, `subject`, `excludedActivityTypes`, `tintColor` and `anchor`. At least one of
 * `message` and `url` is required.
 *
 * @since 0.5.0
 * @category Model
 */
export type Content = ShareContent & ShareOptions

/**
 * How the sheet closed. iOS tells `Shared`, with the activity the user picked when it names one, from
 * `Dismissed`. Android cannot tell them apart: it reports `Shared`, with no activity, as soon as the sheet
 * opens.
 *
 * @since 0.5.0
 * @category Model
 */
export type Result =
  | { readonly _tag: 'Shared'; readonly activityType: Option.Option<string> }
  | { readonly _tag: 'Dismissed' }

/**
 * Why sharing failed: the platform could not show the sheet, for example with no activity to show it in.
 *
 * @since 0.5.0
 * @category Model
 */
export type ShareError = { readonly _tag: 'ShareFailed'; readonly error: unknown }

// -------------------------------------------------------------------------------------
// constructors
// -------------------------------------------------------------------------------------

/**
 * @since 0.5.0
 * @category Constructors
 */
export const shareFailed = (error: unknown): ShareError => ({ _tag: 'ShareFailed', error })

// -------------------------------------------------------------------------------------
// tasks
// -------------------------------------------------------------------------------------

/**
 * Opens the share sheet with `content` and succeeds with how it closed. Fails with `ShareFailed` when the
 * platform cannot show it.
 *
 * @since 0.5.0
 * @category Tasks
 */
export const shareTask = (content: Content): Effect.Effect<Result, ShareError> =>
  Effect.map(
    Effect.tryPromise({
      try: () => {
        // React Native takes the content and the options apart.
        const { dialogTitle, excludedActivityTypes, tintColor, subject, anchor, ...shared } = content
        return NativeShare.share(shared, { dialogTitle, excludedActivityTypes, tintColor, subject, anchor })
      },
      catch: shareFailed,
    }),
    ({ action, activityType }): Result =>
      action === 'dismissedAction'
        ? { _tag: 'Dismissed' }
        : { _tag: 'Shared', activityType: Option.fromNullishOr(activityType) },
  )

// -------------------------------------------------------------------------------------
// commands
// -------------------------------------------------------------------------------------

/**
 * `shareTask` as a command, with `onSuccess` and `onError` handlers as in `Http.send`.
 *
 * @since 0.5.0
 * @category Commands
 */
export const share = <Msg>(
  content: Content,
  handlers: {
    readonly onSuccess: (result: Result) => Msg
    readonly onError: (error: ShareError) => Msg
  },
): Cmd.Cmd<Msg> =>
  Stream.fromEffect(Effect.match(shareTask(content), { onSuccess: handlers.onSuccess, onFailure: handlers.onError }))

/**
 * `shareTask` as a command that produces no message, however the sheet closes and whether it opens or not.
 *
 * @since 0.5.0
 * @category Commands
 */
export const shareIgnoreErrors = (content: Content): Cmd.Cmd<never> =>
  Stream.fromEffectDrain(Effect.ignore(shareTask(content)))
