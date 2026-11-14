import { Effect, Fiber, Option, Stream } from 'effect'
import * as Cmd from 'tea-effect/Cmd'
import * as Html from 'tea-effect/Html'
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

  describe('screens', () => {
    const home = Stack.of('home')

    const keysOf = <Screen>(screens: Stack.Screens<Screen>) => screens.entries.map(entry => entry.key)

    it('of starts with the root under key 0', () => {
      expect(home).toEqual({ entries: [{ key: 0, screen: 'home' }], nextKey: 1 })
    })

    it('push puts a screen on top under a new key, and top gives it', () => {
      const screens = Stack.push(Stack.push(home, 'a'), 'b')
      expect(keysOf(screens)).toEqual([0, 1, 2])
      expect(Stack.top(screens)).toEqual({ key: 2, screen: 'b' })
    })

    it('a key is never given twice, even after a pop', () => {
      expect(keysOf(Stack.push(Stack.push(Stack.pop(Stack.push(home, 'a')), 'b'), 'c'))).toEqual([0, 2, 3])
    })

    it('pop takes the top off, and on the root the stack comes back as it was', () => {
      expect(Stack.pop(Stack.push(home, 'a')).entries).toEqual(home.entries)
      expect(Stack.pop(home)).toBe(home)
    })

    it('dismiss takes off count screens, from the one under key down', () => {
      const screens = Stack.push(Stack.push(Stack.push(home, 'a'), 'b'), 'c')
      expect(keysOf(Stack.dismiss(screens, 3, 1))).toEqual([0, 1, 2])
      expect(keysOf(Stack.dismiss(screens, 3, 2))).toEqual([0, 1])
    })

    it('dismiss keeps the root, and ignores the root and keys that are not on the stack', () => {
      const screens = Stack.push(home, 'a')
      expect(keysOf(Stack.dismiss(screens, 1, 9))).toEqual([0])
      expect(Stack.dismiss(screens, 0, 1)).toBe(screens)
      expect(Stack.dismiss(screens, 7, 1)).toBe(screens)
    })

    it('set replaces only the screen under key', () => {
      const screens = Stack.push(Stack.push(home, 'a'), 'b')
      const next = Stack.set(screens, 1, 'A')
      expect(next.entries.map(entry => entry.screen)).toEqual(['home', 'A', 'b'])
      expect(next.entries[0]).toBe(screens.entries[0])
      expect(next.entries[2]).toBe(screens.entries[2])
      expect(next.nextKey).toBe(screens.nextKey)
    })

    it('set ignores a screen that left the stack while its message was on the way', () => {
      const screens = Stack.pop(Stack.push(home, 'a'))
      expect(Stack.set(screens, 1, 'late')).toBe(screens)
    })

    it('get finds a screen by key, and nothing once it left', () => {
      const screens = Stack.push(home, 'a')
      expect(Stack.get(screens, 1)).toEqual(Option.some('a'))
      expect(Stack.get(Stack.pop(screens), 1)).toEqual(Option.none())
    })

    it('canGoBack only above the root', () => {
      expect(Stack.canGoBack(home)).toBe(false)
      expect(Stack.canGoBack(Stack.push(home, 'a'))).toBe(true)
    })
  })

  describe('keyed', () => {
    const screen =
      (key: number) =>
      (msg: string): string =>
        `${key}:${msg}`

    it('gives the same wrapper for the same key, made once', () => {
      const toMsg = vi.fn(screen)
      const screenMsg = Stack.keyed(toMsg)
      expect(screenMsg(1)).toBe(screenMsg(1))
      expect(toMsg).toHaveBeenCalledTimes(1)
      expect(screenMsg(1)('refresh')).toBe('1:refresh')
    })

    it('gives each key its own wrapper', () => {
      const screenMsg = Stack.keyed(screen)
      expect(screenMsg(1)).not.toBe(screenMsg(2))
      expect(screenMsg(2)('refresh')).toBe('2:refresh')
    })

    it('so Html.map hands a screen the same dispatch on every render, which a fresh wrapper would not', () => {
      const dispatch = (_msg: string): void => undefined
      const handed = (wrap: (msg: string) => string) =>
        Html.map(wrap)((screenDispatch: Platform.Dispatch<string>) => screenDispatch)(dispatch)
      const screenMsg = Stack.keyed(screen)
      expect(handed(screenMsg(1))).toBe(handed(screenMsg(1)))
      expect(handed(screen(1))).not.toBe(handed(screen(1)))
    })
  })

  describe('onBack', () => {
    it('does not subscribe on the root, so the press leaves the app', () => {
      expect(keys(Stack.onBack(Stack.of('home'), () => 'back'))).toEqual([])
    })

    it('subscribes above the root and turns the press into a message', async () => {
      const screens = Stack.push(Stack.of('home'), 'a')
      expect(keys(Stack.onBack(screens, () => 'back'))).toEqual(['callback:stack:hardware-back'])
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const fiber = yield* collect(
            Stack.onBack(screens, () => 'back'),
            1,
          )
          const consumed = pressHardwareBack()
          return { consumed, messages: yield* Fiber.join(fiber) }
        }),
      )
      expect(result).toEqual({ consumed: true, messages: ['back'] })
    })
  })
})
