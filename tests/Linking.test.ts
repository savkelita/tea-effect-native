import { Effect, Fiber, Option, Stream } from 'effect'
import * as Sub from 'tea-effect/Sub'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as Linking from '../src/Linking'
import { linking, receiveUrl } from './testing/react-native'

// The runtime runs a subscription on its own fiber and interrupts it once the
// model stops asking for it. The tests do the same.
const start = <Msg>(sub: Sub.Sub<Msg>) => Effect.forkChild(Stream.runDrain(sub), { startImmediately: true })

const collect = <Msg>(sub: Sub.Sub<Msg>, count: number) =>
  Effect.forkChild(Stream.runCollect(Stream.take(sub, count)), { startImmediately: true })

const keys = <Msg>(sub: Sub.Sub<Msg>) => Sub.getSubEntries(sub).map(entry => entry.key)

const messages = <Msg>(cmd: Stream.Stream<Msg>) => Effect.runPromise(Stream.runCollect(cmd))

describe('Linking', () => {
  afterEach(() => {
    linking.initialUrl = () => Promise.resolve(null)
    linking.openUrl = () => Promise.resolve()
    linking.opened.length = 0
  })

  describe('getInitialUrlTask', () => {
    it('gives the link that started the application', async () => {
      linking.initialUrl = () => Promise.resolve('notes://note/2')
      expect(await Effect.runPromise(Linking.getInitialUrlTask)).toEqual(Option.some('notes://note/2'))
    })

    it('gives None when the application started without a link', async () => {
      for (const none of [null, undefined, '']) {
        linking.initialUrl = () => Promise.resolve(none)
        expect(await Effect.runPromise(Linking.getInitialUrlTask)).toEqual(Option.none())
      }
    })

    it('fails with InitialUrlFailed when the platform throws', async () => {
      const error = new Error('no activity')
      linking.initialUrl = () => Promise.reject(error)
      expect(await Effect.runPromise(Effect.flip(Linking.getInitialUrlTask))).toEqual(Linking.initialUrlFailed(error))
    })
  })

  describe('getInitialUrl', () => {
    const handlers = {
      onSuccess: (url: Option.Option<string>) => `url ${Option.getOrElse(url, () => 'none')}`,
      onError: (error: Linking.LinkingError) => `error ${error._tag}`,
    }

    it('hands the link, or None, to onSuccess', async () => {
      linking.initialUrl = () => Promise.resolve('notes://note/2')
      expect(await messages(Linking.getInitialUrl(handlers))).toEqual(['url notes://note/2'])
      linking.initialUrl = () => Promise.resolve(null)
      expect(await messages(Linking.getInitialUrl(handlers))).toEqual(['url none'])
    })

    it('hands a failure to onError', async () => {
      linking.initialUrl = () => Promise.reject(new Error('no activity'))
      expect(await messages(Linking.getInitialUrl(handlers))).toEqual(['error InitialUrlFailed'])
    })
  })

  describe('openUrlTask', () => {
    it('hands the link to the platform', async () => {
      await Effect.runPromise(Linking.openUrlTask('https://example.com'))
      expect(linking.opened).toEqual(['https://example.com'])
    })

    it('fails with OpenFailed, naming the link, when nothing can open it', async () => {
      const error = new Error('No Activity found to handle Intent')
      linking.openUrl = () => Promise.reject(error)
      expect(await Effect.runPromise(Effect.flip(Linking.openUrlTask('unknown://x')))).toEqual(
        Linking.openFailed('unknown://x', error),
      )
    })
  })

  describe('openUrl', () => {
    const handlers = {
      onSuccess: () => 'opened',
      onError: (error: Linking.LinkingError) => `error ${error._tag}`,
    }

    it('reports the outcome through the handlers', async () => {
      expect(await messages(Linking.openUrl('https://example.com', handlers))).toEqual(['opened'])
      linking.openUrl = () => Promise.reject(new Error('No Activity found to handle Intent'))
      expect(await messages(Linking.openUrl('unknown://x', handlers))).toEqual(['error OpenFailed'])
    })

    it('openUrlIgnoreErrors opens the link and produces no message, even when it fails', async () => {
      expect(await messages(Linking.openUrlIgnoreErrors('https://example.com'))).toEqual([])
      linking.openUrl = () => Promise.reject(new Error('No Activity found to handle Intent'))
      expect(await messages(Linking.openUrlIgnoreErrors('unknown://x'))).toEqual([])
      expect(linking.opened).toEqual(['https://example.com', 'unknown://x'])
    })
  })

  describe('onUrl', () => {
    it('turns every link that arrives into a message, through toMsg', async () => {
      const received = await Effect.runPromise(
        Effect.gen(function* () {
          const fiber = yield* collect(
            Linking.onUrl(url => `link ${url}`),
            2,
          )
          receiveUrl('notes://note/1')
          receiveUrl('notes://note/2')
          return yield* Fiber.join(fiber)
        }),
      )
      expect(received).toEqual(['link notes://note/1', 'link notes://note/2'])
    })

    it('stops listening once its subscription is interrupted', async () => {
      const toMsg = vi.fn((url: string) => url)
      await Effect.runPromise(
        Effect.gen(function* () {
          const fiber = yield* start(Linking.onUrl(toMsg))
          receiveUrl('notes://note/1')
          yield* Fiber.interrupt(fiber)
          receiveUrl('notes://note/2')
        }),
      )
      expect(toMsg.mock.calls).toEqual([['notes://note/1']])
    })

    it('keeps one key, so the runtime keeps it running across models', () => {
      expect(keys(Linking.onUrl(url => url))).toEqual(['callback:linking:url'])
    })
  })
})
