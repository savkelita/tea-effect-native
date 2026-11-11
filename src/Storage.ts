/**
 * Storage keeps values across launches, as `tea-effect/LocalStorage` does in the browser: the same tasks
 * and commands, values encoded with a `Schema`, and failures as a typed `StorageError`.
 *
 * React Native has no storage of its own, so a storage is made from a `Backend`: the three methods that
 * AsyncStorage, `expo-secure-store` and similar libraries share. The package depends on none of them. An
 * application usually makes two storages, one over AsyncStorage for ordinary data and one over a secure
 * store for the session and other secrets.
 *
 * @since 0.2.0
 */
import { Effect, Option, Schema, Stream, type Duration } from 'effect'
import type * as Cmd from 'tea-effect/Cmd'

// -------------------------------------------------------------------------------------
// model
// -------------------------------------------------------------------------------------

/**
 * The three methods a storage needs from the library that keeps the values. AsyncStorage passes as it is,
 * and `expo-secure-store` as `{ getItem: getItemAsync, setItem: setItemAsync, removeItem: deleteItemAsync }`.
 *
 * A secure store usually limits keys: `expo-secure-store` takes only letters, digits, `.`, `-` and `_`,
 * and rejects any other key when it is called.
 *
 * @since 0.2.0
 * @category Model
 */
export type Backend = {
  readonly getItem: (key: string) => Promise<string | null>
  readonly setItem: (key: string, value: string) => Promise<void>
  readonly removeItem: (key: string) => Promise<void>
}

/**
 * Error that can occur during storage operations.
 *
 * `ReadFailed` and `WriteFailed` carry what the backend threw, and `TimedOut` is a read that did not answer
 * in time. The other three concern the value: stored text that is not JSON, JSON that does not match the
 * schema, and a value the schema cannot encode.
 *
 * @since 0.2.0
 * @category Model
 */
export type StorageError =
  | { readonly _tag: 'ReadFailed'; readonly key: string; readonly error: unknown }
  | { readonly _tag: 'WriteFailed'; readonly key: string; readonly error: unknown }
  | { readonly _tag: 'TimedOut'; readonly key: string }
  | { readonly _tag: 'JsonParseError'; readonly key: string; readonly error: unknown }
  | { readonly _tag: 'DecodeError'; readonly key: string; readonly error: Schema.SchemaError }
  | { readonly _tag: 'EncodeError'; readonly key: string; readonly error: Schema.SchemaError }

/**
 * A storage over one backend, made by `make`. The tasks give raw `Effect` access, for tests or for
 * composing with other effects. The commands follow `Http.send`, with `onSuccess` and `onError` handlers,
 * and the `IgnoreErrors` commands produce no message at all.
 *
 * @since 0.2.0
 * @category Model
 */
export type Storage = {
  /** Reads the value under `key` and decodes it with `schema`. `Option.none()` means the key is not there. */
  readonly getTask: <A, I>(key: string, schema: Schema.Codec<A, I>) => Effect.Effect<Option.Option<A>, StorageError>
  /** Encodes `value` with `schema` and writes it under `key`. */
  readonly setTask: <A, I>(key: string, schema: Schema.Codec<A, I>, value: A) => Effect.Effect<void, StorageError>
  /** Removes the value under `key`. */
  readonly removeTask: (key: string) => Effect.Effect<void, StorageError>
  /** `getTask` as a command. */
  readonly get: <A, I, Msg>(
    key: string,
    schema: Schema.Codec<A, I>,
    handlers: {
      readonly onSuccess: (data: Option.Option<A>) => Msg
      readonly onError: (error: StorageError) => Msg
    },
  ) => Cmd.Cmd<Msg>
  /** `setTask` as a command. */
  readonly set: <A, I, Msg>(
    key: string,
    schema: Schema.Codec<A, I>,
    value: A,
    handlers: {
      readonly onSuccess: () => Msg
      readonly onError: (error: StorageError) => Msg
    },
  ) => Cmd.Cmd<Msg>
  /** `setTask` as a command that produces no message, whether the write succeeds or not. */
  readonly setIgnoreErrors: <A, I>(key: string, schema: Schema.Codec<A, I>, value: A) => Cmd.Cmd<never>
  /** `removeTask` as a command. */
  readonly remove: <Msg>(
    key: string,
    handlers: {
      readonly onSuccess: () => Msg
      readonly onError: (error: StorageError) => Msg
    },
  ) => Cmd.Cmd<Msg>
  /** `removeTask` as a command that produces no message, whether the removal succeeds or not. */
  readonly removeIgnoreErrors: (key: string) => Cmd.Cmd<never>
}

/**
 * Options for `make`.
 *
 * @since 0.2.0
 * @category Model
 */
export type Options = {
  /** How long a read may take before it fails with `TimedOut`. Defaults to 10 seconds. */
  readonly readTimeout?: Duration.Input
}

// -------------------------------------------------------------------------------------
// constructors
// -------------------------------------------------------------------------------------

/**
 * Constructs a ReadFailed error.
 *
 * @since 0.2.0
 * @category Constructors
 */
export const readFailed = (key: string, error: unknown): StorageError => ({ _tag: 'ReadFailed', key, error })

/**
 * Constructs a WriteFailed error.
 *
 * @since 0.2.0
 * @category Constructors
 */
export const writeFailed = (key: string, error: unknown): StorageError => ({ _tag: 'WriteFailed', key, error })

/**
 * Constructs a TimedOut error.
 *
 * @since 0.2.0
 * @category Constructors
 */
export const timedOut = (key: string): StorageError => ({ _tag: 'TimedOut', key })

/**
 * Constructs a JsonParseError.
 *
 * @since 0.2.0
 * @category Constructors
 */
export const jsonParseError = (key: string, error: unknown): StorageError => ({ _tag: 'JsonParseError', key, error })

/**
 * Constructs a DecodeError.
 *
 * @since 0.2.0
 * @category Constructors
 */
export const decodeError = (key: string, error: Schema.SchemaError): StorageError => ({
  _tag: 'DecodeError',
  key,
  error,
})

/**
 * Constructs an EncodeError.
 *
 * @since 0.2.0
 * @category Constructors
 */
export const encodeError = (key: string, error: Schema.SchemaError): StorageError => ({
  _tag: 'EncodeError',
  key,
  error,
})

/**
 * Makes a storage over `backend`. Values are stored as JSON text, encoded and decoded with the schema
 * passed to each call.
 *
 * Reads fail with `TimedOut` after `readTimeout`, 10 seconds by default. A read that never answers would
 * otherwise keep the program waiting, for example on the session while the application starts. A read that
 * waits for the user, such as a secure store behind biometrics, needs a longer timeout.
 *
 * @since 0.2.0
 * @category Constructors
 * @example
 * ```ts
 * import { Option, Schema } from 'effect'
 * import * as Storage from 'tea-effect-native/Storage'
 *
 * // In an application, Storage.make(AsyncStorage) for ordinary data, and for secrets
 * // Storage.make({ getItem: getItemAsync, setItem: setItemAsync, removeItem: deleteItemAsync })
 * // over expo-secure-store. A Map stands in for both here.
 * const values = new Map<string, string>()
 *
 * const storage = Storage.make({
 *   getItem: key => Promise.resolve(values.get(key) ?? null),
 *   setItem: (key, value) => {
 *     values.set(key, value)
 *     return Promise.resolve()
 *   },
 *   removeItem: key => {
 *     values.delete(key)
 *     return Promise.resolve()
 *   },
 * })
 *
 * const Session = Schema.Struct({ token: Schema.String })
 *
 * type Msg =
 *   | { readonly _tag: 'SessionLoaded'; readonly session: Option.Option<typeof Session.Type> }
 *   | { readonly _tag: 'SessionLoadFailed'; readonly error: Storage.StorageError }
 *
 * // `session` is an Option: None simply means nothing has been saved yet.
 * export const loadSession = storage.get('session', Session, {
 *   onSuccess: (session): Msg => ({ _tag: 'SessionLoaded', session }),
 *   onError: (error): Msg => ({ _tag: 'SessionLoadFailed', error }),
 * })
 * ```
 */
export const make = (backend: Backend, options: Options = {}): Storage => {
  const readTimeout = options.readTimeout ?? '10 seconds'

  const getTask = <A, I>(key: string, schema: Schema.Codec<A, I>): Effect.Effect<Option.Option<A>, StorageError> =>
    Effect.gen(function* () {
      const raw = yield* Effect.tryPromise({
        try: () => backend.getItem(key),
        catch: error => readFailed(key, error),
      })
      if (raw === null) return Option.none()
      const parsed = yield* Effect.try({
        try: (): unknown => JSON.parse(raw),
        catch: error => jsonParseError(key, error),
      })
      const value = yield* Effect.mapError(Schema.decodeUnknownEffect(schema)(parsed), error => decodeError(key, error))
      return Option.some(value)
    }).pipe(Effect.timeoutOrElse({ duration: readTimeout, orElse: () => Effect.fail(timedOut(key)) }))

  const setTask = <A, I>(key: string, schema: Schema.Codec<A, I>, value: A): Effect.Effect<void, StorageError> =>
    Effect.gen(function* () {
      const json = yield* Effect.mapError(Schema.encodeEffect(Schema.fromJsonString(schema))(value), error =>
        encodeError(key, error),
      )
      yield* Effect.tryPromise({
        try: () => backend.setItem(key, json),
        catch: error => writeFailed(key, error),
      })
    })

  const removeTask = (key: string): Effect.Effect<void, StorageError> =>
    Effect.tryPromise({
      try: () => backend.removeItem(key),
      catch: error => writeFailed(key, error),
    })

  return {
    getTask,
    setTask,
    removeTask,
    get: (key, schema, handlers) =>
      Stream.fromEffect(
        Effect.match(getTask(key, schema), { onSuccess: handlers.onSuccess, onFailure: handlers.onError }),
      ),
    set: (key, schema, value, handlers) =>
      Stream.fromEffect(
        Effect.match(setTask(key, schema, value), {
          onSuccess: () => handlers.onSuccess(),
          onFailure: handlers.onError,
        }),
      ),
    setIgnoreErrors: (key, schema, value) => Stream.fromEffectDrain(Effect.ignore(setTask(key, schema, value))),
    remove: (key, handlers) =>
      Stream.fromEffect(
        Effect.match(removeTask(key), {
          onSuccess: () => handlers.onSuccess(),
          onFailure: handlers.onError,
        }),
      ),
    removeIgnoreErrors: key => Stream.fromEffectDrain(Effect.ignore(removeTask(key))),
  }
}
