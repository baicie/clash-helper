import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

interface EasBuildArtifact {
  buildUrl?: string
  applicationArchiveUrl?: string
}

interface EasBuildResult {
  id?: string
  platform?: string
  artifacts?: EasBuildArtifact
  artifactUrl?: string
  buildUrl?: string
  applicationArchiveUrl?: string
}

const [, , jsonFile, outDir = 'dist', filePrefix = 'clash-helper'] =
  process.argv

if (!jsonFile) {
  console.error(
    'Usage: tsx scripts/publish-artifacts.ts <eas-json-file> [out-dir] [file-prefix]',
  )
  process.exit(1)
}

function normalizeBuilds(payload: unknown): EasBuildResult[] {
  if (Array.isArray(payload)) {
    return payload as EasBuildResult[]
  }

  if (payload && typeof payload === 'object') {
    return [payload as EasBuildResult]
  }

  return []
}

function getArtifactUrl(build: EasBuildResult) {
  return (
    build.artifacts?.buildUrl ??
    build.artifacts?.applicationArchiveUrl ??
    build.artifactUrl ??
    build.buildUrl ??
    build.applicationArchiveUrl
  )
}

function getPlatform(build: EasBuildResult) {
  const platform = String(build.platform ?? '').toLowerCase()

  if (platform === 'android' || platform === 'ios') {
    return platform
  }

  return 'unknown'
}

function getExtension(platform: string, url: string) {
  try {
    const pathname = new URL(url).pathname
    const ext = pathname.split('.').pop()?.toLowerCase()

    if (ext === 'apk' || ext === 'aab' || ext === 'ipa') {
      return ext
    }
  } catch {
    // ignore
  }

  if (platform === 'android') {
    return 'apk'
  }

  if (platform === 'ios') {
    return 'ipa'
  }

  return 'bin'
}

async function downloadFile(url: string, filePath: string) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(
      `Download failed: ${response.status} ${response.statusText} ${url}`,
    )
  }

  const buffer = Buffer.from(await response.arrayBuffer())

  await writeFile(filePath, buffer)
}

async function main() {
  const raw = await readFile(jsonFile, 'utf8')
  const payload = JSON.parse(raw)
  const builds = normalizeBuilds(payload)

  if (builds.length === 0) {
    throw new Error(`No EAS build result found in ${jsonFile}`)
  }

  await mkdir(outDir, { recursive: true })

  const downloadedFiles: string[] = []

  for (const build of builds) {
    const artifactUrl = getArtifactUrl(build)

    if (!artifactUrl) {
      console.error('EAS build result without artifact URL:')
      console.error(JSON.stringify(build, null, 2))
      throw new Error('Cannot find artifact URL from EAS build JSON')
    }

    const platform = getPlatform(build)
    const extension = getExtension(platform, artifactUrl)
    const buildId = String(build.id ?? 'unknown').slice(0, 8)
    const fileName = `${filePrefix}-${platform}-${buildId}.${extension}`
    const filePath = path.join(outDir, fileName)

    console.log(`Downloading ${platform} artifact:`)
    console.log(artifactUrl)

    await downloadFile(artifactUrl, filePath)

    downloadedFiles.push(filePath)
  }

  console.log('Downloaded artifact files:')
  for (const file of downloadedFiles) {
    console.log(`- ${file}`)
  }

  if (process.env.GITHUB_OUTPUT) {
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `files<<EOF\n${downloadedFiles.join('\n')}\nEOF\n`,
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
