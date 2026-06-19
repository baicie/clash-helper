import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { release } from '@baicie/release'

const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf-8'))

release({
  repo: 'clash-helper',
  packages: [pkg.name],
  toTag: (pkg, version) => `${pkg}@${version}`,
  getPkgDir: () => resolve(),
})
