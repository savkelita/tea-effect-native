/**
 * Alert shows the platform's alert dialog and sends the message of the button the user pressed.
 *
 * It is React Native's `Alert.alert` with messages in place of callbacks: the dialog takes React Native's
 * fields in one record, as `Http.request` does, and a button carries the message that pressing it sends.
 * A button without a message closes the dialog and sends nothing, as dismissing the picker of
 * `tea-effect/File` does.
 *
 * The platforms differ. Android shows at most three buttons, the first three, and lets the user dismiss
 * the dialog - by tapping outside it or with the back button - only when `cancelable` is set; dismissing
 * sends `onDismiss`. iOS shows every button, draws `cancel` and `destructive` ones apart, and has no
 * dismissal. `Alert.prompt` has no counterpart here, because only iOS has it.
 *
 * @since 0.5.0
 */
import { type Array as Arr, Effect, Option, Stream } from 'effect'
import { Alert as NativeAlert, type AlertButtonStyle, type AlertOptions } from 'react-native'
import type * as Cmd from 'tea-effect/Cmd'

// -------------------------------------------------------------------------------------
// model
// -------------------------------------------------------------------------------------

/**
 * How a button looks. iOS draws `cancel` and `destructive` buttons apart from the others; Android draws
 * them all the same.
 *
 * @since 0.5.0
 * @category Model
 */
export type Style = AlertButtonStyle

/**
 * A button of the dialog, with React Native's fields. Pressing it closes the dialog and sends `onPress`,
 * when the button has one. `isPreferred` marks the button iOS highlights.
 *
 * @since 0.5.0
 * @category Model
 */
export interface Button<Msg> {
  readonly text: string
  readonly onPress?: Msg
  readonly style?: Style
  readonly isPreferred?: boolean
}

// -------------------------------------------------------------------------------------
// commands
// -------------------------------------------------------------------------------------

/**
 * Shows the dialog and sends the message of the button the user presses, or `onDismiss` when the user
 * dismisses it on Android. A button without a message, and a dismissal without `onDismiss`, end the
 * command with no message.
 *
 * The dialog needs at least one button, so that the user can close it, and every way of closing it ends
 * the command. `cancelable` and `onDismiss` are Android's; `userInterfaceStyle` is iOS's.
 *
 * @since 0.5.0
 * @category Commands
 */
export const alert = <Msg>(config: {
  readonly title: string
  readonly message?: string
  readonly buttons: Arr.NonEmptyReadonlyArray<Button<Msg>>
  readonly cancelable?: boolean
  readonly onDismiss?: Msg
  readonly userInterfaceStyle?: AlertOptions['userInterfaceStyle']
}): Cmd.Cmd<Msg> =>
  Stream.fromEffect(
    Effect.callback<Option.Option<Msg>>(resume => {
      // Every way the dialog closes resumes the command: a press, with the button's message or none, and a
      // dismissal on Android, with onDismiss or none. React Native calls one of them, once.
      const close = (msg: Msg | undefined) => () => resume(Effect.succeed(Option.fromUndefinedOr(msg)))
      NativeAlert.alert(
        config.title,
        config.message,
        config.buttons.map(button => ({
          text: button.text,
          style: button.style,
          isPreferred: button.isPreferred,
          onPress: close(button.onPress),
        })),
        { cancelable: config.cancelable, onDismiss: close(config.onDismiss), userInterfaceStyle: config.userInterfaceStyle },
      )
    }),
  ).pipe(Stream.flatMap(msg => Option.match(msg, { onNone: () => Stream.empty, onSome: value => Stream.make(value) })))
