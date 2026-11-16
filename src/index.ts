/**
 * tea-effect-native - The Elm Architecture for React Native with Effect
 *
 * React Native adapters for tea-effect: the runtime, `Cmd` and `Sub` stay in
 * `tea-effect`, and this package connects a program to the platform. This entry
 * re-exports the modules, beginning with `Root` below: what a program renders
 * into. The subpaths - `tea-effect-native/Root`, `tea-effect-native/Stack`,
 * `tea-effect-native/Storage`, `tea-effect-native/AppState`,
 * `tea-effect-native/Linking`, `tea-effect-native/Alert`,
 * `tea-effect-native/Share` - export the same modules, as `tea-effect/Cmd` does.
 * `tea-effect-native/ScreenStack` is a subpath only: it needs
 * `react-native-screens`, so this entry leaves it out and an application without
 * that package can still import everything else from here.
 *
 * @since 0.1.0
 */
// The overview and `Root`'s description share one block on purpose: docgen attaches
// a file's leading comment to the first declaration in it, so a second JSDoc here
// would be silently dropped and `Root` would render with the overview text.
export * as Root from './Root'

/**
 * A stack of screens kept in the model: the screens themselves, pushing routes and
 * Android's back button.
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

/**
 * The application coming to the foreground and leaving it, as a subscription.
 *
 * @since 0.4.0
 */
export * as AppState from './AppState'

/**
 * Links: the one that started the application, the ones that arrive while it runs,
 * and opening a link in another application.
 *
 * @since 0.4.0
 */
export * as Linking from './Linking'

/**
 * The platform's alert dialog, sending the message of the button the user pressed.
 *
 * @since 0.5.0
 */
export * as Alert from './Alert'

/**
 * The platform's share sheet, with how it closed as a message.
 *
 * @since 0.5.0
 */
export * as Share from './Share'
