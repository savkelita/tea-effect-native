// The example uses tea-effect-native from this repository (file:../..), not from npm. npm links it, and
// Metro follows the link to the repository root, whose node_modules hold the library's own copies of
// react, react-native and the other peer dependencies. Metro must never load those: two copies of React
// break hooks, and two of React Native do not start at all. So the root's node_modules is blocked, and
// every package is resolved from the example's node_modules.
const path = require('node:path')
const { getDefaultConfig } = require('expo/metro-config')

const root = path.resolve(__dirname, '../..')

const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const config = getDefaultConfig(__dirname)

const blocked = config.resolver.blockList
const defaults = blocked === undefined ? [] : Array.isArray(blocked) ? blocked : [blocked]

config.watchFolders = [root]
config.resolver.blockList = [...defaults, new RegExp(`^${escape(path.join(root, 'node_modules'))}[\\\\/].*$`)]
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')]

module.exports = config
