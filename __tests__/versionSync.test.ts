import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import { syncAppVersion } from '../scripts/version-sync'
import { APP_VERSION } from '../src/version'

describe('app version sync', () => {
  it('keeps the displayed app version aligned with package.json', () => {
    const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as {
      version: string
    }
    const appJson = JSON.parse(readFileSync(resolve('app.json'), 'utf8')) as {
      expo: { version: string }
    }

    expect(APP_VERSION).toBe(pkg.version)
    expect(APP_VERSION).toBe(appJson.expo.version)
  })

  it('updates release version sources from an explicit version', async () => {
    const rootDir = mkdtempSync(resolve(tmpdir(), 'clash-helper-version-'))

    try {
      writeFileSync(
        resolve(rootDir, 'package.json'),
        '{"name":"test","version":"1.0.0"}\n',
      )
      writeFileSync(
        resolve(rootDir, 'app.json'),
        '{"expo":{"name":"Test","version":"1.0.0"}}\n',
      )
      await syncAppVersion(rootDir, '1.1.0-beta.1')

      expect(
        JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8'))
          .version,
      ).toBe('1.1.0-beta.1')
      expect(
        JSON.parse(readFileSync(resolve(rootDir, 'app.json'), 'utf8')).expo
          .version,
      ).toBe('1.1.0-beta.1')
    } finally {
      rmSync(rootDir, { recursive: true, force: true })
    }
  })
})
