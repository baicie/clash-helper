import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { release } from '@baicie/release'
import { syncAppVersion } from './version-sync'

const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf-8'))

await release({
  repo: 'clash-helper',
  packages: [pkg.name],
  toTag: (pkg, version) => `${pkg}@${version}`,
  getPkgDir: () => resolve(),
  generateChangelog: async (_pkg, version) => {
    await syncAppVersion(process.cwd(), version)
  },

  // 同步 app.json：每次 release 让 expo.version 跟着 package.json version 走
  appJson: {
    enabled: true,
    file: 'app.json',
    versionNameStrategy: 'exact',
    // versionCode 不传 → 让 EAS autoIncrement 自己管
    // 想让 release 工具管就改成 'auto'，并把 eas.json 的 autoIncrement 设为 false
  },
})
