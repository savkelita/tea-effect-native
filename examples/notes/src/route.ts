import * as Stack from 'tea-effect-native/Stack'

export type Route = { readonly _tag: 'Note'; readonly id: number }

export const noteRoute = (id: number): Route => ({ _tag: 'Note', id })

// Screens push routes here; the app subscribes and opens them.
export const stack = Stack.make<Route>()
