// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot as createDomRoot, type Root as DomRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import * as Root from '../src/Root'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

describe('Root', () => {
  let container: HTMLDivElement
  let dom: DomRoot

  // React Native mounts the registered component from the native side; here
  // react-dom does it, through the same reconciler.
  const mount = (root: Root.Root): void => {
    container = document.createElement('div')
    dom = createDomRoot(container)
    act(() => dom.render(createElement(root.Component)))
  }

  afterEach(() => {
    act(() => dom.unmount())
  })

  describe('createRoot', () => {
    it('shows nothing until something is rendered', () => {
      mount(Root.createRoot())
      expect(container.innerHTML).toBe('')
    })

    it('shows what was rendered before it mounted', () => {
      const root = Root.createRoot()
      root.render(createElement('span', null, 'first'))
      root.render(createElement('span', null, 'second'))
      mount(root)
      expect(container.innerHTML).toBe('<span>second</span>')
    })

    it('shows every render after it mounted', () => {
      const root = Root.createRoot()
      mount(root)
      act(() => root.render(createElement('span', null, 'first')))
      expect(container.innerHTML).toBe('<span>first</span>')
      act(() => root.render(createElement('span', null, 'second')))
      expect(container.innerHTML).toBe('<span>second</span>')
    })
  })
})
