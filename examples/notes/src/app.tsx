import { Data, Match, Option } from 'effect'
import * as Cmd from 'tea-effect/Cmd'
import * as Html from 'tea-effect/Html'
import type * as Platform from 'tea-effect/Platform'
import type * as TeaReact from 'tea-effect/React'
import * as Sub from 'tea-effect/Sub'
import * as AppState from 'tea-effect-native/AppState'
import * as Linking from 'tea-effect-native/Linking'
import { ScreenStack } from 'tea-effect-native/ScreenStack'
import * as Stack from 'tea-effect-native/Stack'
import { Layout } from './layout'
import * as List from './list'
import * as NoteScreen from './note'
import { LAST_OPENED, LastOpened, find, fromLink, storage, type Note } from './notes'
import { stack, type Route } from './route'

type Screen = Data.TaggedEnum<{
  ListScreen: { readonly model: List.Model }
  NoteScreen: { readonly model: NoteScreen.Model }
}>

const Screen = Data.taggedEnum<Screen>()

type ScreenMsg = Data.TaggedEnum<{
  ListMsg: { readonly msg: List.Msg }
  NoteMsg: { readonly msg: NoteScreen.Msg }
}>

const ScreenMsg = Data.taggedEnum<ScreenMsg>()

const listMsg = (msg: List.Msg): ScreenMsg => ScreenMsg.ListMsg({ msg })
const noteMsg = (msg: NoteScreen.Msg): ScreenMsg => ScreenMsg.NoteMsg({ msg })

export type Model = {
  readonly screens: Stack.Screens<Screen>
  readonly lastOpened: Option.Option<Note>
  readonly status: AppState.Status
  readonly returns: number
}

export type Msg = Data.TaggedEnum<{
  Screen: { readonly key: number; readonly msg: ScreenMsg }
  RouteRequested: { readonly route: Route }
  BackPressed: {}
  Dismissed: { readonly key: number; readonly count: number }
  LastOpenedLoaded: { readonly id: Option.Option<number> }
  StatusChanged: { readonly status: AppState.Status }
  InitialUrl: { readonly url: Option.Option<string> }
  UrlReceived: { readonly url: string }
}>

const Msg = Data.taggedEnum<Msg>()

const screen =
  (key: number) =>
  (msg: ScreenMsg): Msg =>
    Msg.Screen({ key, msg })
const routeRequested = (route: Route): Msg => Msg.RouteRequested({ route })
const backPressed = (): Msg => Msg.BackPressed()
const dismissed = (key: number, count: number): Msg => Msg.Dismissed({ key, count })
const lastOpenedLoaded = (id: Option.Option<number>): Msg => Msg.LastOpenedLoaded({ id })
const statusChanged = (status: AppState.Status): Msg => Msg.StatusChanged({ status })
const initialUrl = (url: Option.Option<string>): Msg => Msg.InitialUrl({ url })
const urlReceived = (url: string): Msg => Msg.UrlReceived({ url })

// One wrapper per screen key, so each screen keeps the same dispatch and memo under it holds.
const screenMsg = Stack.keyed(screen)

export const init: [Model, Cmd.Cmd<Msg>] = [
  {
    screens: Stack.of(Screen.ListScreen({ model: List.init })),
    lastOpened: Option.none(),
    status: 'active',
    returns: 0,
  },
  Cmd.batch([
    storage.get(LAST_OPENED, LastOpened, {
      onSuccess: lastOpenedLoaded,
      onError: () => lastOpenedLoaded(Option.none()),
    }),
    Linking.getInitialUrl({ onSuccess: initialUrl, onError: () => initialUrl(Option.none()) }),
  ]),
]

const open = (model: Model, note: Note): [Model, Cmd.Cmd<Msg>] => [
  {
    ...model,
    screens: Stack.push(model.screens, Screen.NoteScreen({ model: NoteScreen.init(note) })),
    lastOpened: Option.some(note),
  },
  storage.setIgnoreErrors(LAST_OPENED, LastOpened, note.id),
]

const openLink = (model: Model, url: string): [Model, Cmd.Cmd<Msg>] =>
  Option.match(fromLink(url), {
    onNone: (): [Model, Cmd.Cmd<Msg>] => [model, Cmd.none],
    onSome: note => open(model, note),
  })

const updateScreen = (msg: ScreenMsg, current: Screen): [Screen, Cmd.Cmd<ScreenMsg>] =>
  ScreenMsg.$match(msg, {
    ListMsg: ({ msg: listMessage }): [Screen, Cmd.Cmd<ScreenMsg>] => {
      if (!Screen.$is('ListScreen')(current)) return [current, Cmd.none]
      const [model, cmd] = List.update(listMessage, current.model)
      return [Screen.ListScreen({ model }), Cmd.map(listMsg)(cmd)]
    },
    NoteMsg: ({ msg: noteMessage }): [Screen, Cmd.Cmd<ScreenMsg>] => {
      if (!Screen.$is('NoteScreen')(current)) return [current, Cmd.none]
      const [model, cmd] = NoteScreen.update(noteMessage, current.model)
      return [Screen.NoteScreen({ model }), Cmd.map(noteMsg)(cmd)]
    },
  })

export const update = (msg: Msg, model: Model): [Model, Cmd.Cmd<Msg>] =>
  Msg.$match(msg, {
    Screen: ({ key, msg: screenMessage }): [Model, Cmd.Cmd<Msg>] =>
      Option.match(Stack.get(model.screens, key), {
        onNone: (): [Model, Cmd.Cmd<Msg>] => [model, Cmd.none],
        onSome: (current): [Model, Cmd.Cmd<Msg>] => {
          const [next, cmd] = updateScreen(screenMessage, current)
          return [{ ...model, screens: Stack.set(model.screens, key, next) }, Cmd.map(screenMsg(key))(cmd)]
        },
      }),

    RouteRequested: ({ route }): [Model, Cmd.Cmd<Msg>] =>
      Match.valueTags(route, {
        Note: ({ id }): [Model, Cmd.Cmd<Msg>] =>
          Option.match(find(id), {
            onNone: (): [Model, Cmd.Cmd<Msg>] => [model, Cmd.none],
            onSome: note => open(model, note),
          }),
      }),

    BackPressed: (): [Model, Cmd.Cmd<Msg>] =>
      Stack.canGoBack(model.screens) ? [{ ...model, screens: Stack.pop(model.screens) }, Cmd.none] : [model, Cmd.none],

    Dismissed: ({ key, count }): [Model, Cmd.Cmd<Msg>] => [
      { ...model, screens: Stack.dismiss(model.screens, key, count) },
      Cmd.none,
    ],

    LastOpenedLoaded: ({ id }): [Model, Cmd.Cmd<Msg>] => [
      { ...model, lastOpened: Option.orElse(model.lastOpened, () => Option.flatMap(id, find)) },
      Cmd.none,
    ],

    StatusChanged: ({ status }): [Model, Cmd.Cmd<Msg>] => [
      { ...model, status, returns: model.status !== 'active' && status === 'active' ? model.returns + 1 : model.returns },
      Cmd.none,
    ],

    InitialUrl: ({ url }): [Model, Cmd.Cmd<Msg>] =>
      Option.match(url, {
        onNone: (): [Model, Cmd.Cmd<Msg>] => [model, Cmd.none],
        onSome: link => openLink(model, link),
      }),

    UrlReceived: ({ url }): [Model, Cmd.Cmd<Msg>] => openLink(model, url),
  })

export const subscriptions = (model: Model): Sub.Sub<Msg> =>
  Sub.batch([
    stack.onPush(routeRequested),
    Stack.onBack(model.screens, backPressed),
    AppState.onChange(statusChanged),
    Linking.onUrl(urlReceived),
  ])

const title = (current: Screen): string =>
  Screen.$match(current, {
    ListScreen: () => 'Notes',
    NoteScreen: ({ model }) => model.note.title,
  })

const screenView =
  (model: Model, current: Screen): TeaReact.Html<ScreenMsg> =>
  (dispatch: Platform.Dispatch<ScreenMsg>) =>
    Screen.$match(current, {
      ListScreen: () =>
        Html.map(listMsg)(List.view({ lastOpened: model.lastOpened, returns: model.returns }))(dispatch),
      NoteScreen: ({ model: noteModel }) => Html.map(noteMsg)(NoteScreen.view(noteModel))(dispatch),
    })

export const view =
  (model: Model): TeaReact.Html<Msg> =>
  (dispatch: Platform.Dispatch<Msg>) => (
    <ScreenStack screens={model.screens} onDismissed={(key, count) => dispatch(dismissed(key, count))}>
      {(entry, index) => (
        <Layout title={title(entry.screen)} onBack={index > 0 ? () => dispatch(backPressed()) : undefined}>
          {Html.map(screenMsg(entry.key))(screenView(model, entry.screen))(dispatch)}
        </Layout>
      )}
    </ScreenStack>
  )
