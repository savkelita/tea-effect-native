import { createElement, type ReactNode } from 'react'

export type ItemProps = Readonly<Record<string, unknown>> & { readonly children?: ReactNode }

// The props of every ScreenStackItem drawn, in order. A test empties it before it draws.
export const items: Array<ItemProps> = []

export const ScreenStack = ({ children }: { readonly children?: ReactNode }) =>
  createElement('div', { 'data-stack': '' }, children)

export const ScreenStackItem = (props: ItemProps) => {
  items.push(props)
  return createElement('section', null, props.children)
}
