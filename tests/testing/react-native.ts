type Handler = () => boolean | null | undefined

const handlers = new Set<Handler>()

export const BackHandler = {
  addEventListener: (_eventName: 'hardwareBackPress', handler: Handler) => {
    handlers.add(handler)
    return {
      remove: (): void => {
        handlers.delete(handler)
      },
    }
  },
}

// As React Native does: the newest handler first, until one returns true. False
// means nobody consumed the press, and React Native would leave the app.
export const pressHardwareBack = (): boolean => [...handlers].reverse().some(handler => handler() === true)

// A test switches the platform by assigning OS before it draws.
export const Platform: { OS: 'android' | 'ios' } = { OS: 'android' }

type AppStateHandler = (status: string) => void

const appStateHandlers = new Set<AppStateHandler>()

export const AppState = {
  addEventListener: (_eventName: 'change', handler: AppStateHandler) => {
    appStateHandlers.add(handler)
    return {
      remove: (): void => {
        appStateHandlers.delete(handler)
      },
    }
  },
}

export const changeAppState = (status: string): void => appStateHandlers.forEach(handler => handler(status))

type UrlListener = (event: { readonly url: string }) => void

const urlListeners = new Set<UrlListener>()

// What getInitialURL and openURL answer, and every link openURL was given. A test sets the answers
// before it runs a task, and resets them afterwards.
export const linking = {
  initialUrl: (): Promise<string | null | undefined> => Promise.resolve(null),
  openUrl: (_url: string): Promise<void> => Promise.resolve(),
  opened: [] as Array<string>,
}

export const Linking = {
  addEventListener: (_eventName: 'url', listener: UrlListener) => {
    urlListeners.add(listener)
    return {
      remove: (): void => {
        urlListeners.delete(listener)
      },
    }
  },
  getInitialURL: () => linking.initialUrl(),
  openURL: (url: string) => {
    linking.opened.push(url)
    return linking.openUrl(url)
  },
}

export const receiveUrl = (url: string): void => urlListeners.forEach(listener => listener({ url }))

type AlertButton = {
  readonly text?: string
  readonly onPress?: () => void
  readonly style?: string
  readonly isPreferred?: boolean
}

type AlertOptions = {
  readonly cancelable?: boolean
  readonly onDismiss?: () => void
  readonly userInterfaceStyle?: string
}

type ShownAlert = {
  readonly title: string
  readonly message: string | undefined
  readonly buttons: ReadonlyArray<AlertButton> | undefined
  readonly options: AlertOptions | undefined
}

// Every dialog shown, newest last, as React Native was given it. A test closes the newest one as the user
// would, and empties the list afterwards.
export const alerts: Array<ShownAlert> = []

export const Alert = {
  alert: (title: string, message?: string, buttons?: ReadonlyArray<AlertButton>, options?: AlertOptions): void => {
    alerts.push({ title, message, buttons, options })
  },
}

// As React Native does: a press calls the button's onPress, and a dismissal calls onDismiss.
export const pressAlertButton = (index: number): void => alerts.at(-1)?.buttons?.[index]?.onPress?.()

export const dismissAlert = (): void => alerts.at(-1)?.options?.onDismiss?.()

type ShareAnswer = { readonly action: string; readonly activityType: string | null | undefined }

// What Share.share answers, and every call it was given. A test sets the answer before it runs a task, and
// resets both afterwards.
export const sharing = {
  answer: (): Promise<ShareAnswer> => Promise.resolve({ action: 'sharedAction', activityType: null }),
  calls: [] as Array<{ readonly content: unknown; readonly options: unknown }>,
}

export const Share = {
  share: (content: unknown, options?: unknown): Promise<ShareAnswer> => {
    sharing.calls.push({ content, options })
    return sharing.answer()
  },
}

export const StyleSheet = {
  absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  create: <T>(styles: T): T => styles,
}
