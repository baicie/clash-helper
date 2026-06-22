import { syncAppVersion } from './version-sync'

const version = await syncAppVersion(process.cwd(), process.argv[2])

console.log(`Synced package.json and app.json -> ${version}`)
