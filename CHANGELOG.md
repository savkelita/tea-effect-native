# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2026-11-14

### Added

- Alert: `alert(config)` shows the platform's alert dialog. It takes React Native's fields in one record, as `Http.request` does, with a message in place of each callback: pressing a button sends its `onPress`, and dismissing the dialog on Android, allowed by `cancelable`, sends `onDismiss`. A button without a message closes the dialog and sends nothing. The dialog needs at least one button, so every way of closing it ends the command
- Share: `shareTask`, `share` and `shareIgnoreErrors` open the platform's share sheet with React Native's content and options in one `Content` record. `Result` is `Shared`, with the activity when iOS names one, or `Dismissed`, which only iOS reports; `ShareError` is `ShareFailed`
- The root entry re-exports both, as `Alert` and `Share`, and `tea-effect-native/Alert` and `tea-effect-native/Share` export them as subpaths
- The example application asks with `Alert` before the note screen leaves the app, and shares a note with `Share`

## [0.4.0] - 2026-11-14

### Added

- AppState: `onChange(toMsg)` subscribes to the application coming to the foreground and leaving it, with React Native's `AppStateStatus` as `Status`
- Linking: `getInitialUrl` and `getInitialUrlTask` read the link that started the application, as `Option.none()` when there was none; `onUrl(toMsg)` subscribes to the links that arrive while it runs
- Linking: `openUrl`, `openUrlTask` and `openUrlIgnoreErrors` open a link in the application registered for it. `LinkingError` tells apart `InitialUrlFailed` and `OpenFailed`, which names the link no application could open
- The root entry re-exports both, as `AppState` and `Linking`, and `tea-effect-native/AppState` and `tea-effect-native/Linking` export them as subpaths
- An example application in `examples/notes` uses every module: `Root`, `Stack` with `ScreenStack`, `Storage`, `AppState` and `Linking`

## [0.3.0] - 2026-11-14

### Added

- Stack: `Screens` and `Entry` keep the stack of screens in the model - entries from the root to the top, each under a key that is never given twice - and `of`, `push`, `pop`, `dismiss`, `set`, `get`, `top` and `canGoBack` change and read it. The root always stays, and a key that has left the stack reads `None` and sets nothing, so a message for a closed screen changes nothing
- Stack: `keyed(toMsg)` remembers one message wrapper per key, so `Html.map` hands a screen the same dispatch on every render and `memo` under it holds
- Stack: `onBack(screens, toMsg)` subscribes to Android's back button only while there is a screen to go back from, so on the root the press leaves the app as usual
- ScreenStack: a new module that draws a `Stack.Screens` with `react-native-screens`. Every screen fills the stack and stays active, so presses on pushed screens land; the native header is hidden; the iOS swipe back is on for every screen but the root and reports through `onDismissed`; Android's back button is left to the model
- `react-native-screens ^4.30.1` is an optional peer dependency, used only by `tea-effect-native/ScreenStack`. The root entry does not re-export `ScreenStack`, so an application without `react-native-screens` can import everything else from it

## [0.2.0] - 2026-11-11

### Added

- Storage: `make(backend, options?)` makes a storage over AsyncStorage, `expo-secure-store` or any backend with `getItem`, `setItem` and `removeItem`, and the package depends on none of them. A storage has the tasks and commands of `tea-effect/LocalStorage` - `getTask`, `setTask`, `removeTask`, `get`, `set`, `setIgnoreErrors`, `remove` and `removeIgnoreErrors` - with values encoded and decoded by a `Schema`
- Storage: `StorageError` tells apart `ReadFailed`, `WriteFailed`, `TimedOut`, `JsonParseError`, `DecodeError` and `EncodeError`, with a constructor for each. Reads fail with `TimedOut` after 10 seconds, or after `readTimeout`
- The root entry re-exports it as `Storage`, and `tea-effect-native/Storage` exports it as a subpath

## [0.1.0] - 2026-11-10

### Added

- Root: `createRoot()` gives `render`, the renderer to pass to `TeaReact.run`, and `Component`, the root component to register with `registerRootComponent` or `AppRegistry.registerComponent`. `Component` shows the last element rendered, including one rendered before it mounted
- Stack: `make<Route>()` creates a typed channel from screens to the model that owns the stack. `push(route)` is a command that produces no message, and `onPush(toMsg)` is the subscription that receives the route. Every channel has its own subscription key, so a model can listen to several channels at once, or move from one to another
- Stack: `onHardwareBack(toMsg)` turns every press of Android's back button into a message and consumes the press
- The root `tea-effect-native` entry re-exports the modules as `Root` and `Stack`, and `tea-effect-native/Root` and `tea-effect-native/Stack` export them as subpaths
