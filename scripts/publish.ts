import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

interface EasBuildRecord {
  platform?: string
  artifacts?: {
    buildUrl?: string
  }
  buildUrl?: string
}

interface ArtifactDownload {
  platform: string
  url: string
}

function printUsage() {
  console.error(
    'Usage: tsx scripts/publish.ts <eas-json-file> <output-dir> <file-prefix>',
  )
}

function readDownloads(value: unknown): ArtifactDownload[] {
  const records = Array.isArray(value) ? value : [value]

  return records.flatMap((record): ArtifactDownload[] => {
    if (!record || typeof record !== 'object') {
      return []
    }

    const build = record as EasBuildRecord
    const url = build.artifacts?.buildUrl ?? build.buildUrl

    if (!url) {
      return []
    }

    return [
      {
        platform: build.platform ?? 'app',
        url,
      },
    ]
  })
}

function getArtifactFileName(download: ArtifactDownload, prefix: string) {
  const parsedUrl = new URL(download.url)
  const extension = extname(parsedUrl.pathname)
  const fallbackExtension = download.platform === 'ios' ? '.ipa' : '.apk'

  return `${prefix}-${download.platform}${extension || fallbackExtension}`
}

async function downloadArtifact(
  download: ArtifactDownload,
  outputPath: string,
) {
  const response = await fetch(download.url)

  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${download.url}: ${response.status}`)
  }

  await pipeline(
    Readable.fromWeb(response.body as unknown as NodeReadableStream),
    createWriteStream(outputPath),
  )
}

async function main() {
  const [jsonFile, outputDir, prefix] = process.argv.slice(2)

  if (!jsonFile || !outputDir || !prefix) {
    printUsage()
    process.exit(1)
  }

  const raw = await readFile(jsonFile, 'utf8')
  const downloads = readDownloads(JSON.parse(raw))

  if (downloads.length === 0) {
    throw new Error(`No EAS build artifact URLs found in ${jsonFile}`)
  }

  await mkdir(outputDir, { recursive: true })

  for (const download of downloads) {
    const fileName = getArtifactFileName(download, prefix)
    const outputPath = join(outputDir, basename(fileName))

    await downloadArtifact(download, outputPath)
    console.log(outputPath)
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
