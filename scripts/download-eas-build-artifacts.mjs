import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const { env, argv, exit } = process

const [, , jsonFile, outDir = 'dist', filePrefix = 'clash-helper'] = argv

if (!jsonFile) {
  console.error(
    'Usage: node scripts/download-eas-build-artifacts.mjs <eas-json-file> [out-dir] [file-prefix]',
  )
  exit(1)
}

function asBuildList(payload) {
  if (Array.isArray(payload)) {
    return payload
  }

  if (payload && typeof payload === 'object') {
    return [payload]
  }

  return []
}

function readArtifactUrl(build) {
  return (
    build?.artifacts?.buildUrl ??
    build?.artifacts?.applicationArchiveUrl ??
    build?.artifactUrl ??
    build?.buildUrl ??
    build?.applicationArchiveUrl
  )
}

function readPlatform(build) {
  const platform = String(build?.platform ?? '').toLowerCase()

  if (platform === 'android' || platform === 'ios') {
    return platform
  }

  return 'unknown'
}

function readExtension(platform, url) {
  try {
    const pathname = new URL(url).pathname
    const ext = pathname.split('.').pop()?.toLowerCase()

    if (ext === 'apk' || ext === 'aab' || ext === 'ipa') {
      return ext
    }
  } catch {
    // ignore invalid URL extension detection
  }

  if (platform === 'ios') {
    return 'ipa'
  }

  if (platform === 'android') {
    return 'apk'
  }

  return 'bin'
}

async function downloadFile(url, filePath) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  await writeFile(filePath, buffer)
}

const raw = await readFile(jsonFile, 'utf8')
const payload = JSON.parse(raw)
const builds = asBuildList(payload)

if (builds.length === 0) {
  throw new Error(`No EAS build entries found in ${jsonFile}`)
}

await mkdir(outDir, { recursive: true })

const downloadedFiles = []

for (const build of builds) {
  const url = readArtifactUrl(build)

  if (!url) {
    console.error(JSON.stringify(build, null, 2))
    throw new Error('EAS build artifact URL was not found in build JSON')
  }

  const platform = readPlatform(build)
  const extension = readExtension(platform, url)
  const buildId = String(build?.id ?? 'unknown').slice(0, 8)
  const fileName = `${filePrefix}-${platform}-${buildId}.${extension}`
  const filePath = path.join(outDir, fileName)

  console.log(`Downloading ${platform} artifact: ${url}`)
  await downloadFile(url, filePath)

  downloadedFiles.push(filePath)
}

console.log('Downloaded files:')
for (const file of downloadedFiles) {
  console.log(`- ${file}`)
}

if (env.GITHUB_OUTPUT) {
  await appendFile(env.GITHUB_OUTPUT, `files<<EOF\n${downloadedFiles.join('\n')}\nEOF\n`)
}
