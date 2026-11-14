import { Effect, Fiber, Stream } from 'effect'
import * as Sub from 'tea-effect/Sub'
import { describe, expect, it, vi } from 'vitest'
import * as AppState from '../src/AppState'
import { changeAppState } from './testing/react-native'

// The runtime runs a subscription on its own fiber and interrupts it once the
// model stops asking for it. The tests do the same.
const start = <Msg>(sub: Sub.Sub<Msg>) => Effect.forkChild(Stream.runDrain(sub), { startImmediately: true })

const collect = <Msg>(sub: Sub.Sub<Msg>, count: number) =>
  Effect.forkChild(Stream.runCollect(Stream.take(sub, count)), { startImmediately: true })

const keys = <Msg>(sub: Sub.Sub<Msg>) => Sub.getSubEntries(sub).map(entry => entry.key)

describe('AppState', () => {
  describe('onChange', () => {
    it('turns every change into a message, through toMsg', async () => {
      const messages = await Effect.runPromise(
        Effect.gen(function* () {
          const fiber = yield* collect(
            AppState.onChange(status => `now ${status}`),
            2,
          )
          changeAppState('background')
          changeAppState('active')
          return yield* Fiber.join(fiber)
        }),
      )
      expect(messages).toEqual(['now background', 'now active'])
    })

    it('stops listening once its subscription is interrupted', async () => {
      const toMsg = vi.fn((status: AppState.Status) => status)
      await Effect.runPromise(
        Effect.gen(function* () {
          const fiber = yield* start(AppState.onChange(toMsg))
          changeAppState('background')
          yield* Fiber.interrupt(fiber)
          changeAppState('active')
        }),
      )
      expect(toMsg.mock.calls).toEqual([['background']])
    })

    it('keeps one key, so the runtime keeps it running across models', () => {
      expect(keys(AppState.onChange(status => status))).toEqual(['callback:app-state:change'])
    })
  })
})
