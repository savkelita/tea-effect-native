import { Effect, Fiber, Stream } from 'effect'
import type * as Cmd from 'tea-effect/Cmd'
import { afterEach, describe, expect, it } from 'vitest'
import * as Alert from '../src/Alert'
import { alerts, dismissAlert, pressAlertButton } from './testing/react-native'

// The runtime runs a command on its own fiber. The test starts it, closes the dialog the way the user
// would, and collects what the command sent once it ended.
const run = <Msg>(cmd: Cmd.Cmd<Msg>, close: () => void) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(Stream.runCollect(cmd), { startImmediately: true })
      close()
      return yield* Fiber.join(fiber)
    }),
  )

const deleteNote = (onDismiss?: string) =>
  Alert.alert({
    title: 'Delete the note?',
    message: 'It cannot be undone.',
    buttons: [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: 'delete' },
    ],
    cancelable: true,
    ...(onDismiss === undefined ? {} : { onDismiss }),
  })

describe('Alert', () => {
  afterEach(() => {
    alerts.length = 0
  })

  it('shows nothing until the command runs, and a dialog every time it runs', async () => {
    const cmd = deleteNote()
    expect(alerts).toEqual([])
    await run(cmd, () => pressAlertButton(0))
    await run(cmd, () => pressAlertButton(0))
    expect(alerts.map(alert => alert.title)).toEqual(['Delete the note?', 'Delete the note?'])
  })

  it("hands React Native the dialog's fields, with a callback for every way it closes", async () => {
    await run(
      Alert.alert({
        title: 'Saved',
        message: 'The note is saved.',
        buttons: [{ text: 'OK', style: 'default', isPreferred: true }],
        cancelable: true,
        userInterfaceStyle: 'dark',
      }),
      () => pressAlertButton(0),
    )
    expect(alerts).toEqual([
      {
        title: 'Saved',
        message: 'The note is saved.',
        buttons: [{ text: 'OK', style: 'default', isPreferred: true, onPress: expect.any(Function) }],
        options: { cancelable: true, onDismiss: expect.any(Function), userInterfaceStyle: 'dark' },
      },
    ])
  })

  it('sends the message of the pressed button', async () => {
    expect(await run(deleteNote(), () => pressAlertButton(1))).toEqual(['delete'])
  })

  it('ends with no message when the pressed button has none', async () => {
    expect(await run(deleteNote(), () => pressAlertButton(0))).toEqual([])
  })

  it('sends onDismiss when the user dismisses the dialog, and ends with no message without it', async () => {
    expect(await run(deleteNote('dismissed'), dismissAlert)).toEqual(['dismissed'])
    expect(await run(deleteNote(), dismissAlert)).toEqual([])
  })
})
