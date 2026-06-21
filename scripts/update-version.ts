import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const pkgJsonPath = resolve('package.json')
const versionFilePath = resolve('src/version.ts')

const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'))
const version = pkg.version as string

const content = `export const APP_VERSION = '${version}'
`

writeFileSync(versionFilePath, content, 'utf-8')

console.log(`Updated src/version.ts → ${version}`)
