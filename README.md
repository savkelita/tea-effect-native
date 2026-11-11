# tea-effect-native

The Elm Architecture for React Native with [Effect](https://effect.website/).

React Native adapters for [tea-effect](https://github.com/savkelita/tea-effect). The runtime, `Cmd`, `Sub`, `Task` and `Http` come from tea-effect; this package only connects a program to the platform.

## Installation

```sh
npm install tea-effect-native tea-effect effect
```

`tea-effect`, `effect`, `react` and `react-native` are peer dependencies, so the application owns their versions. The ranges are narrow on purpose while a single application has been tested: `tea-effect ^0.11.0`, `effect ~4.0.7`, `react ^19.3.0` and `react-native ^0.88.1`.

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

The model owns the stack of screens and the view draws it, for example with `react-native-screens`. `tea-effect-native/Stack` carries the two events that come from outside its `update`: a screen opening a route, and Android's back button.

```ts
// route.ts
import * as Stack from "tea-effect-native/Stack";

export type Route = { readonly _tag: "Home" } | { readonly _tag: "Account" };

export const stack = Stack.make<Route>();
```

A screen returns the `push` command from its `update`, without knowing who opens the route:

```ts
case "AccountClicked":
  return [model, stack.push({ _tag: "Account" })];
```

The model that owns the stack subscribes to it, and to the back button only while there is a screen to go back from (`routeRequested: (route: Route) => Msg`, `backPressed: () => Msg`):

```ts
export const subscriptions = (model: Model): Sub.Sub<Msg> =>
  model.screens.length > 1
    ? Sub.batch([stack.onPush(routeRequested), Stack.onHardwareBack(backPressed)])
    : stack.onPush(routeRequested);
```

`onHardwareBack` consumes the press, so React Native does not leave the app. Without the subscription the press is handled as usual. iOS has no back button, so nothing arrives there.

Every `Stack.make()` gets its own subscription key, so a model can listen to several stacks at once, or move from one to another. The key does not depend on `toMsg`: while the model keeps a subscription, the runtime keeps the first `toMsg`. Pass message constructors such as `routeRequested` and `backPressed`, not closures over the model.

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

| Module    | Description                                                                       |
| --------- | --------------------------------------------------------------------------------- |
| `Root`    | The root component a program renders into                                         |
| `Stack`   | Pushing routes and Android's back button for a screen stack                       |
| `Storage` | Values kept across launches, over AsyncStorage, a secure store or another backend |

The root `tea-effect-native` entry re-exports all three, as `Root`, `Stack` and `Storage`.

## Requirements

- React Native 0.88 and React 19.3, with tea-effect 0.11 and Effect 4.0
- Node.js `^22.13.0 || ^24.3.0 || >=26.0.0`, the range React Native 0.88 accepts
- A bundler that reads `exports` maps, for the `tea-effect-native/X` subpaths - Metro does by default in current React Native

## License

MIT
