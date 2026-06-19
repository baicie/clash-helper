import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { publish } from '@baicie/release'

const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf-8'))

publish({
  defaultPackage: pkg.name,
  packageManager: 'pnpm',
})
