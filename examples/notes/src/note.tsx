import { Data, Option } from 'effect'
import { StyleSheet, Text, View } from 'react-native'
import * as Cmd from 'tea-effect/Cmd'
import type * as Platform from 'tea-effect/Platform'
import type * as TeaReact from 'tea-effect/React'
import * as Alert from 'tea-effect-native/Alert'
import * as Linking from 'tea-effect-native/Linking'
import * as Share from 'tea-effect-native/Share'
import { Button } from './layout'
import type { Note } from './notes'

// What happened last on the screen, shown under the buttons.
type Outcome = Data.TaggedEnum<{
  Stayed: {}
  AlertDismissed: {}
  LinkFailed: { readonly error: Linking.LinkingError }
  ShareClosed: { readonly result: Share.Result }
  ShareFailed: { readonly error: Share.ShareError }
}>

const Outcome = Data.taggedEnum<Outcome>()

export type Model = {
  readonly note: Note
  readonly outcome: Option.Option<Outcome>
}

export type Msg = Data.TaggedEnum<{
  RepositoryPressed: {}
  OpenRepository: {}
  Stayed: {}
  AlertDismissed: {}
  OpenUnknown: {}
  LinkOpened: {}
  LinkFailed: { readonly error: Linking.LinkingError }
  SharePressed: {}
  ShareClosed: { readonly result: Share.Result }
  ShareFailed: { readonly error: Share.ShareError }
}>

export const Msg = Data.taggedEnum<Msg>()

const repositoryPressed = (): Msg => Msg.RepositoryPressed()
const openRepository = (): Msg => Msg.OpenRepository()
const stayed = (): Msg => Msg.Stayed()
const alertDismissed = (): Msg => Msg.AlertDismissed()
const openUnknown = (): Msg => Msg.OpenUnknown()
const linkOpened = (): Msg => Msg.LinkOpened()
const linkFailed = (error: Linking.LinkingError): Msg => Msg.LinkFailed({ error })
const sharePressed = (): Msg => Msg.SharePressed()
const shareClosed = (result: Share.Result): Msg => Msg.ShareClosed({ result })
const shareFailed = (error: Share.ShareError): Msg => Msg.ShareFailed({ error })

const REPOSITORY = 'https://github.com/savkelita/tea-effect-native'

// No application on the device opens this scheme, so opening it fails with OpenFailed.
const UNKNOWN = 'teanotes-unknown://nothing'

export const init = (note: Note): Model => ({ note, outcome: Option.none() })

const open = (url: string): Cmd.Cmd<Msg> => Linking.openUrl(url, { onSuccess: linkOpened, onError: linkFailed })

// Every way the question closes sends a message here, so the screen can show it: Stay, Open, and on
// Android a tap outside the dialog or the back button.
const leave: Cmd.Cmd<Msg> = Alert.alert({
  title: 'Leave the app?',
  message: 'GitHub opens in the browser.',
  buttons: [
    { text: 'Stay', style: 'cancel', onPress: stayed() },
    { text: 'Open', onPress: openRepository() },
  ],
  cancelable: true,
  onDismiss: alertDismissed(),
})

// Android sends only the message and the title, so the message carries the whole note.
const share = (note: Note): Cmd.Cmd<Msg> =>
  Share.share(
    { title: note.title, message: `${note.title}\n\n${note.body}`, dialogTitle: 'Share the note' },
    { onSuccess: shareClosed, onError: shareFailed },
  )

const show = (model: Model, outcome: Outcome): [Model, Cmd.Cmd<Msg>] => [
  { ...model, outcome: Option.some(outcome) },
  Cmd.none,
]

export const update = (msg: Msg, model: Model): [Model, Cmd.Cmd<Msg>] =>
  Msg.$match(msg, {
    RepositoryPressed: (): [Model, Cmd.Cmd<Msg>] => [{ ...model, outcome: Option.none() }, leave],
    OpenRepository: (): [Model, Cmd.Cmd<Msg>] => [model, open(REPOSITORY)],
    Stayed: () => show(model, Outcome.Stayed()),
    AlertDismissed: () => show(model, Outcome.AlertDismissed()),
    OpenUnknown: (): [Model, Cmd.Cmd<Msg>] => [{ ...model, outcome: Option.none() }, open(UNKNOWN)],
    LinkOpened: (): [Model, Cmd.Cmd<Msg>] => [model, Cmd.none],
    LinkFailed: ({ error }) => show(model, Outcome.LinkFailed({ error })),
    SharePressed: (): [Model, Cmd.Cmd<Msg>] => [{ ...model, outcome: Option.none() }, share(model.note)],
    ShareClosed: ({ result }) => show(model, Outcome.ShareClosed({ result })),
    ShareFailed: ({ error }) => show(model, Outcome.ShareFailed({ error })),
  })

// What the platform reported, as it reported it: Android says Shared as soon as the sheet opens.
const describeShare = (result: Share.Result): string =>
  result._tag === 'Dismissed'
    ? 'Share sheet: Dismissed'
    : Option.match(result.activityType, {
        onNone: () => 'Share sheet: Shared',
        onSome: activity => `Share sheet: Shared with ${activity}`,
      })

const describe = (outcome: Outcome): string =>
  Outcome.$match(outcome, {
    Stayed: () => 'You stayed in the app',
    AlertDismissed: () => 'You dismissed the question',
    LinkFailed: ({ error }) =>
      error._tag === 'OpenFailed' ? `No application can open ${error.url}` : 'The link could not be read',
    ShareClosed: ({ result }) => describeShare(result),
    ShareFailed: () => 'The share sheet could not open',
  })

const styles = StyleSheet.create({
  screen: { gap: 12, padding: 16 },
  body: { fontSize: 16, color: '#242424' },
  outcome: { fontSize: 14, color: '#616161' },
})

export const view =
  (model: Model): TeaReact.Html<Msg> =>
  (dispatch: Platform.Dispatch<Msg>) => (
    <View style={styles.screen}>
      <Text style={styles.body}>{model.note.body}</Text>
      <Button label="Open tea-effect-native on GitHub" onPress={() => dispatch(repositoryPressed())} />
      <Button label="Open a link no app can open" onPress={() => dispatch(openUnknown())} />
      <Button label="Share this note" onPress={() => dispatch(sharePressed())} />
      {Option.match(model.outcome, {
        onNone: () => null,
        onSome: outcome => <Text style={styles.outcome}>{describe(outcome)}</Text>,
      })}
    </View>
  )
