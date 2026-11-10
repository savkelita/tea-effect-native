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
