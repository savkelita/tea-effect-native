import { Data, Option } from 'effect'
import { StyleSheet, Text, View } from 'react-native'
import * as Cmd from 'tea-effect/Cmd'
import type * as Platform from 'tea-effect/Platform'
import type * as TeaReact from 'tea-effect/React'
import * as Linking from 'tea-effect-native/Linking'
import { Button } from './layout'
import type { Note } from './notes'

export type Model = {
  readonly note: Note
  readonly failure: Option.Option<Linking.LinkingError>
}

export type Msg = Data.TaggedEnum<{
  OpenRepository: {}
  OpenUnknown: {}
  LinkOpened: {}
  LinkFailed: { readonly error: Linking.LinkingError }
}>

export const Msg = Data.taggedEnum<Msg>()

const openRepository = (): Msg => Msg.OpenRepository()
const openUnknown = (): Msg => Msg.OpenUnknown()
const linkOpened = (): Msg => Msg.LinkOpened()
const linkFailed = (error: Linking.LinkingError): Msg => Msg.LinkFailed({ error })

const REPOSITORY = 'https://github.com/savkelita/tea-effect-native'

// No application on the device opens this scheme, so opening it fails with OpenFailed.
const UNKNOWN = 'teanotes-unknown://nothing'

export const init = (note: Note): Model => ({ note, failure: Option.none() })

const open = (url: string): Cmd.Cmd<Msg> => Linking.openUrl(url, { onSuccess: linkOpened, onError: linkFailed })

export const update = (msg: Msg, model: Model): [Model, Cmd.Cmd<Msg>] =>
  Msg.$match(msg, {
    OpenRepository: (): [Model, Cmd.Cmd<Msg>] => [{ ...model, failure: Option.none() }, open(REPOSITORY)],
    OpenUnknown: (): [Model, Cmd.Cmd<Msg>] => [{ ...model, failure: Option.none() }, open(UNKNOWN)],
    LinkOpened: (): [Model, Cmd.Cmd<Msg>] => [model, Cmd.none],
    LinkFailed: ({ error }): [Model, Cmd.Cmd<Msg>] => [{ ...model, failure: Option.some(error) }, Cmd.none],
  })

const describe = (error: Linking.LinkingError): string =>
  error._tag === 'OpenFailed' ? `No application can open ${error.url}` : 'The link could not be read'

const styles = StyleSheet.create({
  screen: { gap: 12, padding: 16 },
  body: { fontSize: 16, color: '#242424' },
  failure: { fontSize: 14, color: '#B10E1C' },
})

export const view =
  (model: Model): TeaReact.Html<Msg> =>
  (dispatch: Platform.Dispatch<Msg>) => (
    <View style={styles.screen}>
      <Text style={styles.body}>{model.note.body}</Text>
      <Button label="Open tea-effect-native on GitHub" onPress={() => dispatch(openRepository())} />
      <Button label="Open a link no app can open" onPress={() => dispatch(openUnknown())} />
      {Option.match(model.failure, {
        onNone: () => null,
        onSome: error => <Text style={styles.failure}>{describe(error)}</Text>,
      })}
    </View>
  )
