# GitHub Actions Workflows

## Overview

This repository includes automated CI/CD and build workflows:

- **Production Deploy**: Automated build → deploy → health-check on every push to `main`
- **Desktop Apps**: Windows (.exe), macOS (.dmg), Linux (.AppImage)
- **Mobile Apps**: Android (APK), iOS (IPA)

## Workflows

### Production Deployment (`deploy-main.yml`) ← **Main CI/CD**

Triggered on every push to `main`. Installs dependencies, compiles for
production, deploys to the configured VM (Replit Reserved VM or any cloud VM
via SSH), and validates the deployment with health checks.

**Triggers:**
- Push to `main` branch (automatic)
- Manual dispatch (workflow_dispatch)

**Jobs:**
1. **Build** — install, type-check, CI tests, `npm run build`, verify artifacts
2. **Deploy** — SSH into the VM, `git pull`, `docker-compose up --build`
3. **Health Check** — polls `/health/liveness`, `/health/readiness`, `/api/health`

**Required secrets** (Settings → Secrets and variables → Actions):

| Secret | Description |
|--------|-------------|
| `SSH_HOST` | VM hostname or IP address |
| `SSH_USER` | SSH username (e.g. `runner` or `ubuntu`) |
| `SSH_PRIVATE_KEY` | Private SSH key (RSA or Ed25519) |
| `SSH_PORT` | SSH port (default: `22`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_PASSWORD` | Redis password |
| `SESSION_SECRET` | Express session secret (≥ 32 chars) |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `GEMINI_API_KEY` | Google Gemini API key *(optional)* |
| `XAI_API_KEY` | xAI API key *(optional)* |
| `MOONSHOT_API_KEY` | Moonshot API key *(optional)* |
| `SENDGRID_API_KEY` | SendGrid API key *(optional)* |
| `STRIPE_SECRET_KEY` | Stripe secret key *(optional)* |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret *(optional)* |
| `SLACK_WEBHOOK` | Slack incoming webhook URL for failure alerts *(optional)* |

**Required variables** (Settings → Secrets and variables → Variables):

| Variable | Description | Example |
|----------|-------------|---------|
| `APP_URL` | Production URL | `https://e-code.ai` |
| `DEPLOY_DIR` | Working directory on the VM | `/home/runner/e-code` |

**Setup steps:**

1. Add the SSH public key to `~/.ssh/authorized_keys` on your VM.
2. Add the corresponding private key as the `SSH_PRIVATE_KEY` secret.
3. Ensure the repository is cloned at `DEPLOY_DIR` on the VM and Docker /
   docker-compose are installed.
4. Set all required secrets and variables in the repository settings.
5. Push to `main` — the pipeline runs automatically.

---

### 1. Desktop Builds (`build-desktop.yml`)

Builds Electron desktop applications for all platforms.

**Triggers:**
- Push to `main` branch (when `desktop/` files change)
- Pull requests to `main` (when `desktop/` files change)
- Manual dispatch (workflow_dispatch)

**Platforms:**
- Linux: AppImage + tar.gz
- Windows: NSIS installer (.exe)
- macOS: DMG + ZIP

### 2. Mobile Builds (`build-mobile.yml`)

Builds React Native/Expo mobile applications via EAS.

**Triggers:**
- Push to `main` branch (when `mobile/` files change)
- Pull requests to `main` (when `mobile/` files change)
- Manual dispatch with profile selection

**Platforms:**
- Android: APK via EAS Build
- iOS: IPA via EAS Build (requires Apple Developer account)

## Required Secrets

Configure these secrets in your GitHub repository settings:

### Desktop Builds

| Secret | Description | Required |
|--------|-------------|----------|
| `GITHUB_TOKEN` | Auto-provided by GitHub | Yes |
| `MACOS_CERTIFICATE` | Base64-encoded .p12 certificate | For signed macOS builds |
| `MACOS_CERTIFICATE_PASSWORD` | Certificate password | For signed macOS builds |
| `APPLE_ID` | Apple Developer email | For notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password | For notarization |
| `APPLE_TEAM_ID` | Apple Developer Team ID | For notarization |

### Mobile Builds

| Secret | Description | Required |
|--------|-------------|----------|
| `EXPO_TOKEN` | Expo access token | Yes |
| `APPLE_ID` | Apple Developer email | For iOS builds |
| `APPLE_TEAM_ID` | Apple Developer Team ID | For iOS builds |

### Repository Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `API_BASE_URL` | Production API URL | `https://e-code.ai/api` |

## Setup Instructions

### 1. Desktop Builds (Unsigned)

Unsigned builds work immediately with no configuration:

```bash
gh workflow run build-desktop.yml -f platforms=all
```

### 2. Desktop Builds (Signed - macOS)

1. **Export your Developer ID certificate:**
   ```bash
   # Export from Keychain Access as .p12 file
   # Base64 encode it:
   base64 -i certificate.p12 -o certificate.txt
   ```

2. **Add secrets:**
   - `MACOS_CERTIFICATE`: Content of certificate.txt
   - `MACOS_CERTIFICATE_PASSWORD`: Your .p12 password

3. **Create app-specific password:**
   - Go to appleid.apple.com → Security → App-Specific Passwords
   - Generate new password for "E-Code Notarization"
   - Add as `APPLE_APP_SPECIFIC_PASSWORD`

### 3. Mobile Builds

1. **Create Expo account** at expo.dev

2. **Generate access token:**
   - Go to expo.dev → Account Settings → Access Tokens
   - Create new token with "Read and write" permissions
   - Add as `EXPO_TOKEN` secret

3. **Run builds:**
   ```bash
   # Android only
   gh workflow run build-mobile.yml -f platform=android -f profile=preview

   # iOS only (requires Apple Developer)
   gh workflow run build-mobile.yml -f platform=ios -f profile=preview

   # Both platforms
   gh workflow run build-mobile.yml -f platform=all -f profile=production
   ```

### 4. iOS Builds (Additional Setup)

1. **Apple Developer Program** ($99/year) required
2. **Configure in Expo:**
   - Add Apple credentials via `eas credentials`
   - Or configure in EAS dashboard

## Build Profiles

### Desktop
- Uses electron-builder configuration from `desktop/package.json`

### Mobile
| Profile | Use Case | Output |
|---------|----------|--------|
| `development` | Testing with dev client | Debug APK (internal) |
| `preview` | Internal testing | Unsigned APK |
| `production` | App Store release | Signed AAB/IPA |

## Artifacts

Build artifacts are available for 30 days:
- GitHub Actions → Select workflow run → Artifacts section

## Troubleshooting

### macOS Notarization Fails
- Ensure app-specific password is correct
- Check Team ID matches your Developer account
- Verify certificate is not expired

### EAS Build Fails
- Check Expo dashboard for detailed logs
- Verify EXPO_TOKEN has correct permissions
- For iOS: ensure Apple credentials are configured

### Windows Code Signing
For signed Windows builds, add:
- `WINDOWS_CERTIFICATE`: Base64 .pfx certificate
- `WINDOWS_CERTIFICATE_PASSWORD`: Certificate password

## Manual Trigger

Use GitHub CLI or web interface:

```bash
# Desktop - all platforms
gh workflow run build-desktop.yml -f platforms=all

# Desktop - specific platform
gh workflow run build-desktop.yml -f platforms=macos

# Mobile - production build
gh workflow run build-mobile.yml -f platform=all -f profile=production
```
