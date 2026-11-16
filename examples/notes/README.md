# tea-effect-native notes

A small Expo application that uses every module of tea-effect-native, and the place where a module is tried
on a device before a release.

| Module                | Where                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `Root`                | `src/main.tsx` renders the program into the registered root component                     |
| `Stack`               | `src/app.tsx` keeps the screens; `src/list.tsx` pushes a note through `stack.push`        |
| `ScreenStack`         | `src/app.tsx` draws the screens, with the platform's push transition and swipe back       |
| `Storage`             | `src/notes.ts` over AsyncStorage: the note opened last, also after a restart              |
| `AppState`            | `src/app.tsx` counts the returns to the application, shown above the list                 |
| `Linking`             | `teanotes://note/2` opens a note; the note screen opens a web page and a link nothing opens |
| `Alert`               | the note screen asks before it leaves the app; Stay, Open and a dismissal each answer     |
| `Share`               | the note screen shares the note and shows what the platform reported                      |

## Running

The application uses tea-effect-native from this repository (`file:../..`), not from npm, so build the
library first, and again after changing it (`npm run dev` in the root rebuilds on every change):

```sh
# in the repository root
npm run build

# here
npm install
npx expo run:android
```

`expo run:android` builds the development build for the connected emulator or phone and installs it, then
`npx expo start --dev-client` serves the JavaScript. The first build takes several minutes; after that only
a native change needs a new one.

npm links the library, and Metro follows the link to the repository root, whose `node_modules` hold the
library's own copies of `react`, `react-native` and the other peer dependencies. `metro.config.js` blocks
that folder, so everything resolves from this application's `node_modules`, and `tsconfig.json` sets
`preserveSymlinks` for the same reason.

## Trying the links

With the application running, a link opens a note, through `Linking.onUrl`:

```sh
adb shell am start -W -a android.intent.action.VIEW -d "teanotes://note/3" io.github.savkelita.teaeffectnative.notes
```

A link that names no note, such as `teanotes://note/9`, is ignored. To try the link that starts the
application, through `Linking.getInitialUrl`, close the application first and send the same command.

The note screen opens this repository in the browser with `Linking.openUrl`, after an `Alert` asks
whether to leave the app, and tries a link no application can open, to show `OpenFailed`. Its share
button opens the share sheet; Android reports `Shared` as soon as the sheet opens.
