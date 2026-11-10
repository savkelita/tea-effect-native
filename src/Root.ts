/**
 * Root is what a tea-effect program renders into on React Native.
 *
 * In the browser, `createRoot` from `react-dom/client` takes a container and the
 * program's renderer calls `root.render`. React Native has no container: it mounts
 * the registered root component itself, from the native side. `createRoot` here
 * keeps the same `root.render` for the renderer and adds the `Component` to
 * register.
 *
 * @since 0.1.0
 */
import { useSyncExternalStore, type ReactNode } from 'react'

// -------------------------------------------------------------------------------------
// model
// -------------------------------------------------------------------------------------

/**
 * A root: `render` hands it the next element, and `Component` shows it.
 *
 * @since 0.1.0
 * @category Model
 */
export type Root = {
  readonly render: (element: ReactNode) => void
  readonly Component: () => ReactNode
}

// -------------------------------------------------------------------------------------
// constructors
// -------------------------------------------------------------------------------------

/**
 * Creates a root. Pass `render` to `TeaReact.run`, and register `Component` with
 * `registerRootComponent` (Expo) or `AppRegistry.registerComponent`.
 *
 * `Component` reads the element through `useSyncExternalStore`, so each `render`
 * redraws it. Until it mounts, `render` only keeps the element, and `Component`
 * shows the last one kept when it mounts, so the program can start before React
 * Native mounts the root.
 *
 * @since 0.1.0
 * @category Constructors
 */
export const createRoot = (): Root => {
  let current: ReactNode = null
  const listeners = new Set<() => void>()

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  const snapshot = (): ReactNode => current

  return {
    render: element => {
      current = element
      listeners.forEach(listener => listener())
    },
    Component: () => useSyncExternalStore(subscribe, snapshot),
  }
}
