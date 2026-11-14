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

export const StyleSheet = {
  absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  create: <T>(styles: T): T => styles,
}
