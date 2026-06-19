import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

type Platform = 'all' | 'android' | 'ios'

interface ReleaseArgs {
  dry: boolean
  platform: Platform
  profile: string
  version: string
}

function readArg(name: string) {
  const prefix = `${name}=`
  const inline = process.argv.find((arg) => arg.startsWith(prefix))

  if (inline) {
    return inline.slice(prefix.length)
  }

  const index = process.argv.indexOf(name)

  return index >= 0 ? process.argv[index + 1] : undefined
}

function parseArgs(): ReleaseArgs {
  const version = readArg('--version') ?? ''
  const platform = (readArg('--platform') ?? 'all') as Platform

  if (!version) {
    throw new Error(
      'Missing --version, for example: pnpm release -- --version 1.0.0',
    )
  }

  if (!['all', 'android', 'ios'].includes(platform)) {
    throw new Error('--platform must be one of: all, android, ios')
  }

  return {
    dry: process.argv.includes('--dry'),
    platform,
    profile: readArg('--profile') ?? 'internal',
    version,
  }
}

function run(command: string, args: string[], dry: boolean) {
  const text = [command, ...args].join(' ')

  if (dry) {
    console.log(`[dry] ${text}`)
    return
  }

  const result = spawnSync(command, args, {
    shell: true,
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function quoteShell(value: string) {
  return `"${value.replace(/"/g, '\\"')}"`
}

function runShell(command: string, dry: boolean) {
  if (dry) {
    console.log(`[dry] ${command}`)
    return
  }

  const result = spawnSync(command, {
    shell: true,
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function runEasBuild(platform: Exclude<Platform, 'all'>, args: ReleaseArgs) {
  const jsonFile = `dist/eas-${platform}.json`
  const prefix = `clash-helper-${args.version}`

  runShell(
    [
      'eas build',
      `--platform ${platform}`,
      `--profile ${quoteShell(args.profile)}`,
      '--wait',
      '--json',
      '--non-interactive',
      `--message ${quoteShell(`Release v${args.version} ${platform}`)}`,
      `> ${quoteShell(jsonFile)}`,
    ].join(' '),
    args.dry,
  )
  run('pnpm', ['publish:artifacts', jsonFile, 'dist', prefix], args.dry)
}

function main() {
  const args = parseArgs()

  run('pnpm', ['check'], args.dry)

  if (args.dry) {
    console.log('[dry] ensure dist directory')
  } else {
    mkdirSync('dist', { recursive: true })
  }

  if (args.platform === 'all' || args.platform === 'android') {
    runEasBuild('android', args)
  }

  if (args.platform === 'all' || args.platform === 'ios') {
    runEasBuild('ios', args)
  }
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
