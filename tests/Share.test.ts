import { Effect, Option, Stream } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import * as Share from '../src/Share'
import { sharing } from './testing/react-native'

const messages = <Msg>(cmd: Stream.Stream<Msg>) => Effect.runPromise(Stream.runCollect(cmd))

describe('Share', () => {
  afterEach(() => {
    sharing.answer = () => Promise.resolve({ action: 'sharedAction', activityType: null })
    sharing.calls.length = 0
  })

  describe('shareTask', () => {
    it('opens nothing until it runs', async () => {
      const task = Share.shareTask({ message: 'Milk' })
      expect(sharing.calls).toEqual([])
      await Effect.runPromise(task)
      expect(sharing.calls).toHaveLength(1)
    })

    it('hands React Native the content and the options apart', async () => {
      await Effect.runPromise(
        Share.shareTask({
          message: 'Milk, eggs',
          title: 'Groceries',
          url: 'https://example.com/groceries',
          dialogTitle: 'Share the note',
          subject: 'Groceries',
          excludedActivityTypes: ['com.apple.UIKit.activity.Print'],
          tintColor: '#0F6CBD',
          anchor: 7,
        }),
      )
      expect(sharing.calls).toEqual([
        {
          content: { message: 'Milk, eggs', title: 'Groceries', url: 'https://example.com/groceries' },
          options: {
            dialogTitle: 'Share the note',
            subject: 'Groceries',
            excludedActivityTypes: ['com.apple.UIKit.activity.Print'],
            tintColor: '#0F6CBD',
            anchor: 7,
          },
        },
      ])
    })

    it('succeeds with Shared, naming the activity when the platform does', async () => {
      sharing.answer = () => Promise.resolve({ action: 'sharedAction', activityType: 'com.apple.UIKit.activity.Mail' })
      expect(await Effect.runPromise(Share.shareTask({ message: 'Milk' }))).toEqual({
        _tag: 'Shared',
        activityType: Option.some('com.apple.UIKit.activity.Mail'),
      })
      for (const none of [null, undefined]) {
        sharing.answer = () => Promise.resolve({ action: 'sharedAction', activityType: none })
        expect(await Effect.runPromise(Share.shareTask({ message: 'Milk' }))).toEqual({
          _tag: 'Shared',
          activityType: Option.none(),
        })
      }
    })

    it('succeeds with Dismissed when the user closed the sheet', async () => {
      sharing.answer = () => Promise.resolve({ action: 'dismissedAction', activityType: null })
      expect(await Effect.runPromise(Share.shareTask({ message: 'Milk' }))).toEqual({ _tag: 'Dismissed' })
    })

    it('fails with ShareFailed when the platform rejects or throws', async () => {
      const error = new Error('E_UNABLE_TO_OPEN_DIALOG')
      sharing.answer = () => Promise.reject(error)
      expect(await Effect.runPromise(Effect.flip(Share.shareTask({ message: 'Milk' })))).toEqual(
        Share.shareFailed(error),
      )
      sharing.answer = () => {
        throw error
      }
      expect(await Effect.runPromise(Effect.flip(Share.shareTask({ message: 'Milk' })))).toEqual(
        Share.shareFailed(error),
      )
    })
  })

  describe('share', () => {
    const handlers = {
      onSuccess: (result: Share.Result) => result._tag,
      onError: (error: Share.ShareError) => `error ${error._tag}`,
    }

    it('reports the outcome through the handlers', async () => {
      expect(await messages(Share.share({ message: 'Milk' }, handlers))).toEqual(['Shared'])
      sharing.answer = () => Promise.resolve({ action: 'dismissedAction', activityType: null })
      expect(await messages(Share.share({ message: 'Milk' }, handlers))).toEqual(['Dismissed'])
      sharing.answer = () => Promise.reject(new Error('E_UNABLE_TO_OPEN_DIALOG'))
      expect(await messages(Share.share({ message: 'Milk' }, handlers))).toEqual(['error ShareFailed'])
    })

    it('shareIgnoreErrors shares and produces no message, even when it fails', async () => {
      expect(await messages(Share.shareIgnoreErrors({ message: 'Milk' }))).toEqual([])
      sharing.answer = () => Promise.reject(new Error('E_UNABLE_TO_OPEN_DIALOG'))
      expect(await messages(Share.shareIgnoreErrors({ url: 'https://example.com' }))).toEqual([])
      expect(sharing.calls.map(call => call.content)).toEqual([{ message: 'Milk' }, { url: 'https://example.com' }])
    })
  })
})
