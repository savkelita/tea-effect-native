import AsyncStorage from '@react-native-async-storage/async-storage'
import { Option, Schema } from 'effect'
import * as Storage from 'tea-effect-native/Storage'

export type Note = {
  readonly id: number
  readonly title: string
  readonly body: string
}

export const notes: ReadonlyArray<Note> = [
  { id: 1, title: 'Groceries', body: 'Milk, bread and coffee.' },
  { id: 2, title: 'Ideas', body: 'A small app that uses every module of tea-effect-native.' },
  { id: 3, title: 'Reading', body: 'The Elm Architecture, and where Effect fits into it.' },
]

export const find = (id: number): Option.Option<Note> => Option.fromNullishOr(notes.find(note => note.id === id))

const LINK = /^teanotes:\/\/note\/(\d+)$/

// teanotes://note/2 names a note. Any other link - such as the one that starts a development build - does not.
export const fromLink = (url: string): Option.Option<Note> =>
  Option.flatMap(Option.fromNullishOr(LINK.exec(url)), ([, id]) => find(Number(id)))

export const storage = Storage.make(AsyncStorage)

export const LAST_OPENED = 'lastOpened'

export const LastOpened = Schema.Number
