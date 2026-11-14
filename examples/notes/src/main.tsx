import { Effect } from 'effect'
import { registerRootComponent } from 'expo'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as TeaReact from 'tea-effect/React'
import { createRoot } from 'tea-effect-native/Root'
import * as App from './app'

const root = createRoot()

registerRootComponent(root.Component)

Effect.runPromise(
  TeaReact.run(TeaReact.program(App.init, App.update, App.view, App.subscriptions), dom =>
    root.render(
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {dom}
      </SafeAreaProvider>,
    ),
  ),
)
