// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot as createDomRoot, type Root as DomRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ScreenStack } from '../src/ScreenStack'
import * as Stack from '../src/Stack'
import { Platform, StyleSheet } from './testing/react-native'
import { items } from './testing/react-native-screens'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

describe('ScreenStack', () => {
  let container: HTMLDivElement
  let dom: DomRoot

  // react-dom draws through the same reconciler React Native uses; the double for
  // react-native-screens keeps the props each native screen got.
  const draw = (screens: Stack.Screens<string>, onDismissed: (key: number, count: number) => void = () => {}) => {
    items.length = 0
    act(() =>
      dom.render(
        createElement(ScreenStack<string>, {
          screens,
          onDismissed,
          children: (entry, index) => createElement('span', null, `${index}:${entry.screen}`),
        }),
      ),
    )
  }

  beforeEach(() => {
    Platform.OS = 'android'
    container = document.createElement('div')
    dom = createDomRoot(container)
  })

  afterEach(() => {
    act(() => dom.unmount())
  })

  const threeScreens = Stack.push(Stack.push(Stack.of('home'), 'a'), 'b')

  it('draws one native screen per entry, the root first, each through children', () => {
    draw(threeScreens)
    expect(items.map(item => item.screenId)).toEqual(['0', '1', '2'])
    expect(container.textContent).toBe('0:home1:a2:b')
  })

  it('gives every screen the full stack and an active state, so presses on pushed screens land', () => {
    draw(threeScreens)
    expect(items.map(item => item.style)).toEqual([StyleSheet.absoluteFill, StyleSheet.absoluteFill, StyleSheet.absoluteFill])
    expect(items.map(item => item.activityState)).toEqual([2, 2, 2])
  })

  it('hides the native header and leaves Android back to the model', () => {
    draw(threeScreens)
    expect(items.map(item => item.headerConfig)).toEqual([{ hidden: true }, { hidden: true }, { hidden: true }])
    expect(items.map(item => item.nativeBackButtonDismissalEnabled)).toEqual([false, false, false])
  })

  it('allows the swipe back on iOS for every screen but the root, and never on Android', () => {
    draw(threeScreens)
    expect(items.map(item => item.gestureEnabled)).toEqual([false, false, false])
    Platform.OS = 'ios'
    draw(threeScreens)
    expect(items.map(item => item.gestureEnabled)).toEqual([false, true, true])
  })

  it('reports a native dismissal with the key and the count, as Stack.dismiss takes them', () => {
    const dismissed: Array<readonly [number, number]> = []
    draw(threeScreens, (key, count) => dismissed.push([key, count]))
    const onDismissed = items[2]?.onDismissed as (event: { readonly nativeEvent: { readonly dismissCount: number } }) => void
    onDismissed({ nativeEvent: { dismissCount: 2 } })
    expect(dismissed).toEqual([[2, 2]])
    expect(Stack.dismiss(threeScreens, 2, 2).entries.map(entry => entry.screen)).toEqual(['home'])
  })

  it('keeps the native screens of the entries that stay when the top is popped', () => {
    draw(threeScreens)
    const kept = container.querySelectorAll('section')[1]
    draw(Stack.pop(threeScreens))
    expect(items.map(item => item.screenId)).toEqual(['0', '1'])
    expect(container.querySelectorAll('section')[1]).toBe(kept)
  })

  it('gives a screen pushed in place of the top a native screen of its own, not the old one', () => {
    draw(threeScreens)
    const replaced = container.querySelectorAll('section')[2]
    draw(Stack.push(Stack.pop(threeScreens), 'c'))
    expect(items.map(item => item.screenId)).toEqual(['0', '1', '3'])
    expect(container.querySelectorAll('section')[2]).not.toBe(replaced)
  })
})
