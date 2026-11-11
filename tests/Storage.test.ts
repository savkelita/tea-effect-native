import { Effect, Option, Schema, Stream } from 'effect'
import type * as Cmd from 'tea-effect/Cmd'
import { describe, expect, it } from 'vitest'
import * as Storage from '../src/Storage'

const Session = Schema.Struct({ token: Schema.String })

// The shape AsyncStorage and expo-secure-store share, kept in a Map.
const memory = () => {
  const values = new Map<string, string>()
  const backend: Storage.Backend = {
    getItem: key => Promise.resolve(values.get(key) ?? null),
    setItem: (key, value) => {
      values.set(key, value)
      return Promise.resolve()
    },
    removeItem: key => {
      values.delete(key)
      return Promise.resolve()
    },
  }
  return { values, backend }
}

const boom = new Error('backend failed')

const failing: Storage.Backend = {
  getItem: () => Promise.reject(boom),
  setItem: () => Promise.reject(boom),
  removeItem: () => Promise.reject(boom),
}

const run = <Msg>(cmd: Cmd.Cmd<Msg>) => Effect.runPromise(Stream.runCollect(cmd))

const failure = <A>(task: Effect.Effect<A, Storage.StorageError>) => Effect.runPromise(Effect.flip(task))

describe('Storage', () => {
  describe('tasks', () => {
    it('getTask reads none for a key that is not there', async () => {
      const storage = Storage.make(memory().backend)
      expect(await Effect.runPromise(storage.getTask('session', Session))).toStrictEqual(Option.none())
    })

    it('setTask writes the value as JSON, and getTask reads it back', async () => {
      const { values, backend } = memory()
      const storage = Storage.make(backend)
      await Effect.runPromise(storage.setTask('session', Session, { token: 'abc' }))
      expect(values.get('session')).toBe('{"token":"abc"}')
      expect(await Effect.runPromise(storage.getTask('session', Session))).toStrictEqual(Option.some({ token: 'abc' }))
    })

    it('removeTask removes the value', async () => {
      const storage = Storage.make(memory().backend)
      await Effect.runPromise(storage.setTask('session', Session, { token: 'abc' }))
      await Effect.runPromise(storage.removeTask('session'))
      expect(await Effect.runPromise(storage.getTask('session', Session))).toStrictEqual(Option.none())
    })

    it('getTask fails with JsonParseError for stored text that is not JSON', async () => {
      const { values, backend } = memory()
      values.set('session', 'not json')
      const error = await failure(Storage.make(backend).getTask('session', Session))
      expect(error).toMatchObject({ _tag: 'JsonParseError', key: 'session' })
    })

    it('getTask fails with DecodeError for JSON that does not match the schema, instead of reading none', async () => {
      const { values, backend } = memory()
      values.set('session', '{"token":1}')
      const error = await failure(Storage.make(backend).getTask('session', Session))
      expect(error).toMatchObject({ _tag: 'DecodeError', key: 'session' })
    })

    it('setTask fails with EncodeError for a value the schema cannot encode, and writes nothing', async () => {
      const { values, backend } = memory()
      const error = await failure(Storage.make(backend).setTask('count', Schema.Int, 1.5))
      expect(error).toMatchObject({ _tag: 'EncodeError', key: 'count' })
      expect(values.has('count')).toBe(false)
    })

    it('a backend that throws fails reads with ReadFailed and writes with WriteFailed, carrying its error', async () => {
      const storage = Storage.make(failing)
      expect(await failure(storage.getTask('session', Session))).toStrictEqual(Storage.readFailed('session', boom))
      expect(await failure(storage.setTask('session', Session, { token: 'abc' }))).toStrictEqual(
        Storage.writeFailed('session', boom),
      )
      expect(await failure(storage.removeTask('session'))).toStrictEqual(Storage.writeFailed('session', boom))
    })

    it('getTask fails with TimedOut when the backend does not answer within readTimeout', async () => {
      const silent: Storage.Backend = { ...memory().backend, getItem: () => new Promise(() => {}) }
      const storage = Storage.make(silent, { readTimeout: '20 millis' })
      expect(await failure(storage.getTask('session', Session))).toStrictEqual(Storage.timedOut('session'))
    })

    it('storages over different backends keep their values apart', async () => {
      const ordinary = Storage.make(memory().backend)
      const secure = Storage.make(memory().backend)
      await Effect.runPromise(secure.setTask('session', Session, { token: 'abc' }))
      expect(await Effect.runPromise(ordinary.getTask('session', Session))).toStrictEqual(Option.none())
    })
  })

  describe('commands', () => {
    type Msg =
      | { readonly _tag: 'Loaded'; readonly session: Option.Option<typeof Session.Type> }
      | { readonly _tag: 'Done' }
      | { readonly _tag: 'Failed'; readonly error: string }

    const handlers = {
      onSuccess: (): Msg => ({ _tag: 'Done' }),
      onError: (error: Storage.StorageError): Msg => ({ _tag: 'Failed', error: error._tag }),
    }

    it('get passes the value to onSuccess', async () => {
      const storage = Storage.make(memory().backend)
      await Effect.runPromise(storage.setTask('session', Session, { token: 'abc' }))
      const messages = await run(
        storage.get('session', Session, {
          onSuccess: (session): Msg => ({ _tag: 'Loaded', session }),
          onError: handlers.onError,
        }),
      )
      expect(messages).toStrictEqual([{ _tag: 'Loaded', session: Option.some({ token: 'abc' }) }])
    })

    it('get, set and remove pass a failure to onError', async () => {
      const storage = Storage.make(failing)
      const loaded = await run(
        storage.get('session', Session, {
          onSuccess: (session): Msg => ({ _tag: 'Loaded', session }),
          onError: handlers.onError,
        }),
      )
      expect(loaded).toStrictEqual([{ _tag: 'Failed', error: 'ReadFailed' }])
      expect(await run(storage.set('session', Session, { token: 'abc' }, handlers))).toStrictEqual([
        { _tag: 'Failed', error: 'WriteFailed' },
      ])
      expect(await run(storage.remove('session', handlers))).toStrictEqual([{ _tag: 'Failed', error: 'WriteFailed' }])
    })

    it('set and remove report success through onSuccess', async () => {
      const { values, backend } = memory()
      const storage = Storage.make(backend)
      expect(await run(storage.set('session', Session, { token: 'abc' }, handlers))).toStrictEqual([{ _tag: 'Done' }])
      expect(values.get('session')).toBe('{"token":"abc"}')
      expect(await run(storage.remove('session', handlers))).toStrictEqual([{ _tag: 'Done' }])
      expect(values.has('session')).toBe(false)
    })

    it('setIgnoreErrors and removeIgnoreErrors write and remove, and produce no message', async () => {
      const { values, backend } = memory()
      const storage = Storage.make(backend)
      expect(await run(storage.setIgnoreErrors('session', Session, { token: 'abc' }))).toStrictEqual([])
      expect(values.get('session')).toBe('{"token":"abc"}')
      expect(await run(storage.removeIgnoreErrors('session'))).toStrictEqual([])
      expect(values.has('session')).toBe(false)
    })

    it('setIgnoreErrors and removeIgnoreErrors produce no message when the backend fails', async () => {
      const storage = Storage.make(failing)
      expect(await run(storage.setIgnoreErrors('session', Session, { token: 'abc' }))).toStrictEqual([])
      expect(await run(storage.removeIgnoreErrors('session'))).toStrictEqual([])
    })
  })
})
