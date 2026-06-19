# Clash Helper

部落冲突村庄升级计时助手。粘贴游戏导出的 JSON，自动计算所有建筑/兵种升级完成时间，本机到点通知提醒。

## Quick Start

```bash
pnpm install
pnpm start
```

Run on a target:

```bash
pnpm android
pnpm ios
pnpm web
```

## Quality Commands

```bash
pnpm type-check
pnpm lint
pnpm format
pnpm test
pnpm check
```

## Project Structure

```text
clash-helper/
|-- .agents/skills/                    # Project-level AI skills
|-- .github/workflows/
|   |-- ci.yml                         # CI: type-check, lint, format, test
|   |-- release.yml                     # Release: EAS Build + GitHub Release
|-- assets/                            # Expo assets
|-- scripts/                           # Local automation
|-- __tests__/                         # Jest tests
|-- src/                               # Source code
|   |-- clash/                         # Clash data parsing
|   |-- notifications/                 # Local notification scheduling
|   |-- storage/                       # AsyncStorage persistence
|-- App.tsx                            # App root
|-- app.json                           # Expo app config
|-- eas.json                           # EAS Build profiles
|-- eslint.config.js                   # ESLint flat config
`-- package.json
```

## Release Installers

This project uses EAS Build from GitHub Actions to produce installable artifacts.

### Required GitHub Secrets

- `EXPO_TOKEN`: Expo access token used by EAS CLI.

### One-time EAS Setup

Run locally once:

```bash
pnpm dlx eas-cli login
pnpm dlx eas-cli init
pnpm dlx eas-cli build --platform android --profile internal
pnpm dlx eas-cli build --platform ios --profile internal
```

Commit the generated EAS project config in `app.json`.

### Release by Tag

```bash
git tag v1.0.0
git push origin v1.0.0
```

The workflow will create a GitHub Release and upload:

- Android `.apk`
- iOS `.ipa`

### Manual Release

Open GitHub Actions, run `Release App Installers`, and choose:

- `platform`: `all`, `android`, or `ios`
- `profile`: `internal`
- `version`: optional version without `v`

## Notes

- This project targets Expo SDK 56.
- Notifications are local-only (no remote push service).
- Countdown reminders use local high-priority notifications.
- Keep native code out of the repository unless intentionally moving away from the managed workflow.
