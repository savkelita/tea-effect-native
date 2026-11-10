import { Effect, Fiber, Option, Stream } from 'effect'
import * as Cmd from 'tea-effect/Cmd'
import * as Platform from 'tea-effect/Platform'
import * as Sub from 'tea-effect/Sub'
import { describe, expect, it, vi } from 'vitest'
import * as Stack from '../src/Stack'
import { pressHardwareBack } from './testing/react-native'

// The runtime runs a subscription on its own fiber and interrupts it once the
// model stops asking for it. The tests do the same.
const start = <Msg>(sub: Sub.Sub<Msg>) => Effect.forkChild(Stream.runDrain(sub), { startImmediately: true })

const collect = <Msg>(sub: Sub.Sub<Msg>, count: number) =>
  Effect.forkChild(Stream.runCollect(Stream.take(sub, count)), { startImmediately: true })

const keys = <Msg>(sub: Sub.Sub<Msg>) => Sub.getSubEntries(sub).map(entry => entry.key)

describe('Stack', () => {
  describe('make', () => {
    it('push hands the route to onPush, through toMsg', async () => {
      const stack = Stack.make<string>()
      const messages = await Effect.runPromise(
        Effect.gen(function* () {
          const fiber = yield* collect(
            stack.onPush(route => `opened ${route}`),
            2,
          )
          yield* Stream.runDrain(stack.push('a'))
          yield* Stream.runDrain(stack.push('b'))
          return yield* Fiber.join(fiber)
        }),
      )
      expect(messages).toEqual(['opened a', 'opened b'])
    })

    it('push produces no message of its own', async () => {
      const stack = Stack.make<string>()
      expect(await Effect.runPromise(Stream.runCollect(stack.push('a')))).toEqual([])
    })

    it('onPush stops listening once its subscription is interrupted', async () => {
      const stack = Stack.make<string>()
      const toMsg = vi.fn((route: string) => route)
      await Effect.runPromise(
        Effect.gen(function* () {
          const fiber = yield* start(stack.onPush(toMsg))
          yield* Stream.runDrain(stack.push('a'))
          yield* Fiber.interrupt(fiber)
          yield* Stream.runDrain(stack.push('b'))
        }),
      )
      expect(toMsg.mock.calls).toEqual([['a']])
    })

    it('onPush keeps one key per stack, so the runtime keeps it running across models', () => {
      const stack = Stack.make<string>()
      expect(keys(stack.onPush(route => `a ${route}`))).toEqual(keys(stack.onPush(route => `b ${route}`)))
    })

    it('each stack gets its own key, so the runtime tells stacks apart', () => {
      expect(keys(Stack.make<string>().onPush(route => route))).not.toEqual(
        keys(Stack.make<string>().onPush(route => route)),
      )
    })

    it('the runtime follows the model from one stack to another', async () => {
      const stacks = { A: Stack.make<string>(), B: Stack.make<string>() }
      type Name = keyof typeof stacks
      type Model = { readonly listening: Name; readonly opened: ReadonlyArray<string> }
      type Msg =
        | { readonly _tag: 'Listen'; readonly to: Name }
        | { readonly _tag: 'Push'; readonly on: Name; readonly route: string }
        | { readonly _tag: 'Opened'; readonly route: string }

      const listen = (to: Name): Msg => ({ _tag: 'Listen', to })
      const push = (on: Name, route: string): Msg => ({ _tag: 'Push', on, route })
      const opened = (route: string): Msg => ({ _tag: 'Opened', route })

      const update = (msg: Msg, model: Model): readonly [Model, Cmd.Cmd<Msg>] => {
        switch (msg._tag) {
          case 'Listen':
            return [{ ...model, listening: msg.to }, Cmd.none]
          case 'Push':
            return [model, stacks[msg.on].push(msg.route)]
          case 'Opened':
            return [{ ...model, opened: [...model.opened, msg.route] }, Cmd.none]
        }
      }

      const subscriptions = (model: Model): Sub.Sub<Msg> => stacks[model.listening].onPush(opened)

      const result = await Effect.runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            const program = yield* Platform.program<Model, Msg>(
              [{ listening: 'A', opened: [] }, Cmd.none],
              update,
              subscriptions,
            )
            for (const msg of [push('A', 'a1'), listen('B'), push('B', 'b1'), push('A', 'a2')]) {
              program.dispatch(msg)
              yield* Effect.sleep('30 millis')
            }
            return Option.getOrThrow(yield* Stream.runHead(program.model$)).opened
          }),
        ),
      )
      expect(result).toEqual(['a1', 'b1'])
    })
  })

  describe('onHardwareBack', () => {
    it('turns a press into a message and consumes the press', async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const fiber = yield* collect(
            Stack.onHardwareBack(() => 'back'),
            1,
          )
          const consumed = pressHardwareBack()
          return { consumed, messages: yield* Fiber.join(fiber) }
        }),
      )
      expect(result).toEqual({ consumed: true, messages: ['back'] })
    })

    it('lets the press through once its subscription is interrupted', async () => {
      const presses = await Effect.runPromise(
        Effect.gen(function* () {
          const fiber = yield* start(Stack.onHardwareBack(() => 'back'))
          const whileRunning = pressHardwareBack()
          yield* Fiber.interrupt(fiber)
          return [whileRunning, pressHardwareBack()]
        }),
      )
      expect(presses).toEqual([true, false])
    })

    it('keeps one key, so the runtime keeps it running across models', () => {
      expect(keys(Stack.onHardwareBack(() => 'back'))).toEqual(['callback:stack:hardware-back'])
    })
  })
})
