# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-11-10

### Added

- Root: `createRoot()` gives `render`, the renderer to pass to `TeaReact.run`, and `Component`, the root component to register with `registerRootComponent` or `AppRegistry.registerComponent`. `Component` shows the last element rendered, including one rendered before it mounted
- Stack: `make<Route>()` creates a typed channel from screens to the model that owns the stack. `push(route)` is a command that produces no message, and `onPush(toMsg)` is the subscription that receives the route. Every channel has its own subscription key, so a model can listen to several channels at once, or move from one to another
- Stack: `onHardwareBack(toMsg)` turns every press of Android's back button into a message and consumes the press
- The root `tea-effect-native` entry re-exports the modules as `Root` and `Stack`, and `tea-effect-native/Root` and `tea-effect-native/Stack` export them as subpaths
