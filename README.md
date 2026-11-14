# tea-effect-native

The Elm Architecture for React Native with [Effect](https://effect.website/).

React Native adapters for [tea-effect](https://github.com/savkelita/tea-effect). The runtime, `Cmd`, `Sub`, `Task` and `Http` come from tea-effect; this package only connects a program to the platform.

## Installation

```sh
npm install tea-effect-native tea-effect effect
```

`tea-effect`, `effect`, `react` and `react-native` are peer dependencies, so the application owns their versions. The ranges are narrow on purpose while a single application has been tested: `tea-effect ^0.11.0`, `effect ~4.0.7`, `react ^19.3.0` and `react-native ^0.88.1`. `react-native-screens ^4.30.1` is an optional peer dependency, needed only for `tea-effect-native/ScreenStack`.

The package is ESM only, like tea-effect and Effect 4.

## Root

In the browser, `createRoot` from `react-dom/client` takes a container and the renderer calls `root.render`. React Native has no container - it mounts the registered root component itself. `createRoot` from `tea-effect-native/Root` keeps `root.render` for the renderer and adds the `Component` to register:

```tsx
// index.tsx
import { Effect } from "effect";
import { registerRootComponent } from "expo";
import * as TeaReact from "tea-effect/React";
import { createRoot } from "tea-effect-native/Root";
import * as App from "./App";

const root = createRoot();

registerRootComponent(root.Component);

Effect.runPromise(
  TeaReact.run(
    TeaReact.program(App.init, App.update, App.view, App.subscriptions),
    (dom) => root.render(dom),
  ),
);
```

Without Expo, register it with `AppRegistry.registerComponent("main", () => root.Component)`. Providers such as `SafeAreaProvider` wrap `dom` before it reaches `root.render`.

`Component` shows the last element rendered, also one rendered before it mounted, so the program can start before React Native mounts the root.

## Stack

In the browser the history belongs to the browser. React Native has none, so the model keeps the stack of screens, and the view only draws it. `tea-effect-native/Stack` gives the stack as data, the functions that change it, and the two events that come from outside `update`: a screen opening a route, and Android's back button.

The screens are `Stack.Screens<Screen>`: entries from the root to the top, each under a key that is never given twice. The application keeps them in its model and changes them only through these functions:

| Function                                                      | What it gives                                                                     |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `Stack.of(screen)`                                            | A stack with its root screen, under key 0                                         |
| `Stack.push(screens, screen)`                                 | The screen on top, under a new key, which `Stack.top(screens)` reads              |
| `Stack.pop(screens)`                                          | The stack without its top screen; the root stays                                  |
| `Stack.dismiss(screens, key, count)`                          | The stack without what the platform closed itself, such as with an iOS swipe back |
| `Stack.get(screens, key)` / `Stack.set(screens, key, screen)` | A screen by its key; a key that has left the stack reads `None` and sets nothing  |
| `Stack.canGoBack(screens)`                                    | Whether there is a screen above the root                                          |

A screen's messages carry its key, so a message for a screen that was closed meanwhile finds nothing (`screen: (key: number) => (msg: ScreenMsg) => Msg`, `updateScreen: (msg: ScreenMsg, screen: Screen) => [Screen, Cmd.Cmd<ScreenMsg>]`):

```ts
const screenMsg = Stack.keyed(screen);

case "Screen":
  return Option.match(Stack.get(model.screens, msg.key), {
    onNone: () => [model, Cmd.none],
    onSome: (current) => {
      const [next, cmd] = updateScreen(msg.msg, current);
      return [
        { ...model, screens: Stack.set(model.screens, msg.key, next) },
        Cmd.map(screenMsg(msg.key))(cmd),
      ];
    },
  });
```

`Stack.keyed` remembers one wrapper per key. `Html.map` keeps the mapped dispatch per mapping function, so a wrapper made anew on every render would hand the screen a new dispatch each time, and every `memo` under it would draw again. Make it once, at module level, and use it for both the screen's commands and its view.

A screen opens a route through a channel, without knowing who owns the stack:

```ts
// route.ts
import * as Stack from "tea-effect-native/Stack";

export type Route = { readonly _tag: "Home" } | { readonly _tag: "Account" };

export const stack = Stack.make<Route>();
```

```ts
case "AccountClicked":
  return [model, stack.push({ _tag: "Account" })];
```

The model that owns the stack subscribes to the channel and to the back button (`routeRequested: (route: Route) => Msg`, `backPressed: () => Msg`, `startScreen: (route: Route) => [Screen, Cmd.Cmd<ScreenMsg>]`):

```ts
export const subscriptions = (model: Model): Sub.Sub<Msg> =>
  Sub.batch([stack.onPush(routeRequested), Stack.onBack(model.screens, backPressed)]);
```

```ts
case "RouteRequested": {
  const [screen, cmd] = startScreen(msg.route);
  const screens = Stack.push(model.screens, screen);
  return [{ ...model, screens }, Cmd.map(screenMsg(Stack.top(screens).key))(cmd)];
}
case "BackPressed":
  return [{ ...model, screens: Stack.pop(model.screens) }, Cmd.none];
```

`Stack.onBack` listens only while there is a screen to go back from, and consumes the press, so React Native does not leave the app. On the root there is no subscription, and the press leaves the app as usual. iOS has no back button, so nothing arrives there. `Stack.onHardwareBack(toMsg)` is the same subscription without the check.

Every `Stack.make()` gets its own subscription key, so a model can listen to several stacks at once, or move from one to another. The key does not depend on `toMsg`: while the model keeps a subscription, the runtime keeps the first `toMsg`. Pass message constructors such as `routeRequested` and `backPressed`, not closures over the model.

## ScreenStack

`tea-effect-native/ScreenStack` draws the screens with [`react-native-screens`](https://github.com/software-mansion/react-native-screens): a native container for each screen and the platform's push transition. It uses that package directly - React Navigation's native stack is built on it - because React Navigation keeps navigation state of its own, and the model would no longer be the only place that knows which screens are open. The package is an optional peer dependency, so install it to use this module:

```sh
npx expo install react-native-screens
```

`children` draws one screen with whatever the application puts around it, such as its header, and `onDismissed` reports what the platform closed itself (`dismissed: (key: number, count: number) => Msg`, `viewScreen: (screen: Screen) => Html<ScreenMsg>`):

```tsx
import { ScreenStack } from "tea-effect-native/ScreenStack";

<ScreenStack screens={model.screens} onDismissed={(key, count) => dispatch(dismissed(key, count))}>
  {(entry, index) => (
    <Layout onBack={index > 0 ? () => dispatch(backPressed()) : undefined}>
      {Html.map(screenMsg(entry.key))(viewScreen(entry.screen))(dispatch)}
    </Layout>
  )}
</ScreenStack>;
```

```ts
case "Dismissed":
  return [{ ...model, screens: Stack.dismiss(model.screens, msg.key, msg.count) }, Cmd.none];
```

Each screen gets what React Navigation's native stack gives it, and what is easy to miss without it:

- `StyleSheet.absoluteFill` and an active state. Without them Fabric lays the screens out one below the other while natively they all start at the top, so a `Pressable` on a pushed screen measures itself a screen lower and cancels the press as soon as a finger moves. `adb shell input tap` sends no move and hides it.
- The native header is hidden, and the application draws its own in `children`.
- The iOS swipe back is on for every screen but the root, and arrives through `onDismissed`.
- Android's back button does not close a screen natively: it reaches the model through `Stack.onBack`, and the model decides.

The root `tea-effect-native` entry does not re-export `ScreenStack`, so an application without `react-native-screens` can import everything else from it. Drawn some other way - the top screen in a plain `View`, say - `Stack` works the same.

## Storage

React Native has no storage of its own, so `tea-effect-native/Storage` makes one from a backend: the three methods that AsyncStorage, `expo-secure-store` and similar libraries share. The package depends on none of them. An application usually makes two storages, one for ordinary data and one for secrets:

```ts
// storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { deleteItemAsync, getItemAsync, setItemAsync } from "expo-secure-store";
import * as Storage from "tea-effect-native/Storage";

export const storage = Storage.make(AsyncStorage);

export const secureStore = Storage.make({
  getItem: getItemAsync,
  setItem: setItemAsync,
  removeItem: deleteItemAsync,
});
```

Both have the tasks and commands of `tea-effect/LocalStorage`. Values are encoded and decoded with a `Schema`, and a key that is not there reads as `Option.none()` (`sessionLoaded: (session: Option.Option<Session>) => Msg`, `sessionLoadFailed: (error: Storage.StorageError) => Msg`):

```ts
const loadSession = secureStore.get("session", Session, {
  onSuccess: sessionLoaded,
  onError: sessionLoadFailed,
});
```

```ts
case "SignedOut":
  return [initial, secureStore.removeIgnoreErrors("session")];
```

`StorageError` tells apart a backend that threw (`ReadFailed`, `WriteFailed`), a read that did not answer (`TimedOut`) and a value that does not fit (`JsonParseError`, `DecodeError`, `EncodeError`). Reads time out after 10 seconds, so a native read that never answers cannot keep the application waiting at startup. `Storage.make(backend, { readTimeout })` changes that, for example for a secure store behind biometrics.

Unlike `LocalStorage`, a storage has no `clear`, `keys` or `onChange`: `expo-secure-store` has neither `clear` nor `keys`, and an application has no other tabs whose writes `onChange` would report. A secure store also limits keys; `expo-secure-store` takes only letters, digits, `.`, `-` and `_`.

## Module Structure

| Module        | Description                                                                         |
| ------------- | ----------------------------------------------------------------------------------- |
| `Root`        | The root component a program renders into                                           |
| `Stack`       | A stack of screens kept in the model, pushing routes and Android's back button      |
| `ScreenStack` | Draws a stack of screens with `react-native-screens`, an optional peer dependency   |
| `Storage`     | Values kept across launches, over AsyncStorage, a secure store or another backend   |

The root `tea-effect-native` entry re-exports `Root`, `Stack` and `Storage`. `ScreenStack` is a subpath only, because it needs `react-native-screens`.

## Requirements

- React Native 0.88 and React 19.3, with tea-effect 0.11 and Effect 4.0
- `react-native-screens` 4.30 for `ScreenStack`
- Node.js `^22.13.0 || ^24.3.0 || >=26.0.0`, the range React Native 0.88 accepts
- A bundler that reads `exports` maps, for the `tea-effect-native/X` subpaths - Metro does by default in current React Native

## License

MIT
