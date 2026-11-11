/**
 * tea-effect-native - The Elm Architecture for React Native with Effect
 *
 * React Native adapters for tea-effect: the runtime, `Cmd` and `Sub` stay in
 * `tea-effect`, and this package connects a program to the platform. This entry
 * re-exports every module, beginning with `Root` below: what a program renders
 * into. The subpaths - `tea-effect-native/Root`, `tea-effect-native/Stack`,
 * `tea-effect-native/Storage` - export the same modules, as `tea-effect/Cmd` does.
 *
 * @since 0.1.0
 */
// The overview and `Root`'s description share one block on purpose: docgen attaches
// a file's leading comment to the first declaration in it, so a second JSDoc here
// would be silently dropped and `Root` would render with the overview text.
export * as Root from './Root'

/**
 * A stack of screens kept in the model: pushing routes and Android's back button.
 *
 * @since 0.1.0
 */
export * as Stack from './Stack'

/**
 * Values kept across launches over any storage backend, with the tasks and commands
 * of `tea-effect/LocalStorage`.
 *
 * @since 0.2.0
 */
export * as Storage from './Storage'
