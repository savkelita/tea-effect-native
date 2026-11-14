import { Data, Option } from 'effect'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type * as Cmd from 'tea-effect/Cmd'
import type * as Platform from 'tea-effect/Platform'
import type * as TeaReact from 'tea-effect/React'
import { notes, type Note } from './notes'
import { noteRoute, stack } from './route'

export type Model = {}

export type Msg = Data.TaggedEnum<{
  Opened: { readonly id: number }
}>

export const Msg = Data.taggedEnum<Msg>()

const opened = (id: number): Msg => Msg.Opened({ id })

export const init: Model = {}

export const update = (msg: Msg, model: Model): [Model, Cmd.Cmd<Msg>] =>
  Msg.$match(msg, {
    Opened: ({ id }): [Model, Cmd.Cmd<Msg>] => [model, stack.push(noteRoute(id))],
  })

// What the list shows that the app keeps: the note opened last, also in an earlier launch, and how many
// times the user came back to the app.
export type Info = {
  readonly lastOpened: Option.Option<Note>
  readonly returns: number
}

const styles = StyleSheet.create({
  status: { gap: 4, padding: 16, backgroundColor: '#F5F5F5' },
  statusText: { fontSize: 14, color: '#616161' },
  row: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  pressed: { backgroundColor: '#F0F0F0' },
  title: { fontSize: 16, fontWeight: '600', color: '#242424' },
  body: { fontSize: 14, color: '#616161' },
})

export const view =
  (info: Info): TeaReact.Html<Msg> =>
  (dispatch: Platform.Dispatch<Msg>) => (
    <View>
      <View style={styles.status}>
        <Text style={styles.statusText}>
          Last opened: {Option.match(info.lastOpened, { onNone: () => 'nothing yet', onSome: note => note.title })}
        </Text>
        <Text style={styles.statusText}>Back in the app {info.returns} times</Text>
      </View>
      {notes.map(note => (
        <Pressable
          key={note.id}
          accessibilityRole="button"
          onPress={() => dispatch(opened(note.id))}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Text style={styles.title}>{note.title}</Text>
          <Text style={styles.body} numberOfLines={1}>
            {note.body}
          </Text>
        </Pressable>
      ))}
    </View>
  )
