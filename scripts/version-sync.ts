import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { format } from 'prettier'

interface VersionedPackageJson {
  version: string
  [key: string]: unknown
}

interface ExpoAppJson {
  expo: {
    version?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

export async function syncAppVersion(
  rootDir = process.cwd(),
  requestedVersion?: string,
) {
  const packagePath = resolve(rootDir, 'package.json')
  const appJsonPath = resolve(rootDir, 'app.json')
  const pkg = JSON.parse(
    readFileSync(packagePath, 'utf8'),
  ) as VersionedPackageJson
  const version = requestedVersion ?? pkg.version

  if (requestedVersion && pkg.version !== version) {
    writeFileSync(
      packagePath,
      await format(JSON.stringify({ ...pkg, version }), { parser: 'json' }),
      'utf8',
    )
  }

  const appJson = JSON.parse(readFileSync(appJsonPath, 'utf8')) as ExpoAppJson
  writeFileSync(
    appJsonPath,
    await format(
      JSON.stringify({
        ...appJson,
        expo: { ...appJson.expo, version },
      }),
      { parser: 'json' },
    ),
    'utf8',
  )
  return version
}
