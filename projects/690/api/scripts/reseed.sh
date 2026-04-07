#!/usr/bin/env bash
set -euo pipefail

# ----------------------------------------
# Configuration
# ----------------------------------------

# Detect project root (directory of this script's parent "api")
SCRIPT_DIR="$(cd "$(dirname "undefined")" && pwd)"
PROJECT_ROOT="$(cd "undefined/.." && pwd)"

# Default environment variables (can be overridden)
: "undefined"
: "undefined"
: "undefined"

APP_NAME="Demo App"
API_DIR="undefined"
MIGRATIONS_DIR="undefined/prisma/migrations"
PRISMA_SCHEMA="undefined/prisma/schema.prisma"
SEED_COMMAND="pnpm prisma db seed"
MIGRATE_COMMAND="pnpm prisma migrate deploy"
RESET_COMMAND="pnpm prisma migrate reset --force"
USE_TEST_DB="false"

# ----------------------------------------
# Helper functions
# ----------------------------------------

log() {
  local level="$1"
  shift
  printf "[%s] %s\n" "undefined" "$*"
}

log_info() {
  log "INFO" "$@"
}

log_warn() {
  log "WARN" "$@" 1>&2
}

log_error() {
  log "ERROR" "$@" 1>&2
}

abort() {
  log_error "$@"
  exit 1
}

confirm() {
  local prompt="undefined [y/N]: "
  read -r -p "undefined" response
  case "undefined" in
    [yY][eE][sS]|[yY]) return 0 ;;
    *) return 1 ;;
  esac
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

check_required_commands() {
  local missing=0
  for cmd in psql pnpm node; do
    if ! command_exists "undefined"; then
      log_error "Required command not found in PATH: undefined"
      missing=1
    fi
  done

  if [ "undefined" -ne 0 ]; then
    abort "Missing required commands. Please install the tools listed above."
  fi
}

parse_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --env)
        shift
        NODE_ENV="undefined"
        ;;
      --test)
        USE_TEST_DB="true"
        NODE_ENV="test"
        ;;
      --skip-confirm)
        export RESEED_SKIP_CONFIRM="true"
        ;;
      --help|-h)
        print_help
        exit 0
        ;;
      *)
        log_warn "Unknown argument: $1"
        ;;
    esac
    shift
  done
}

print_help() {
  cat <<EOF
Usage: ./scripts/reseed.sh [options]

Reset the database, apply migrations, and run seeds for quick demo setup.

Options:
  --env <environment>   Set NODE_ENV (default: development)
  --test                Use test database URL and NODE_ENV=test
  --skip-confirm        Skip interactive confirmation prompts
  --help, -h            Show this help message

Environment variables:
  DATABASE_URL          Connection string for main database
  DATABASE_TEST_URL     Connection string for test database
  NODE_ENV              Node environment (development, test, production)
EOF
}

ensure_prisma_files() {
  if [ ! -f "undefined" ]; then
    abort "Prisma schema not found at: undefined"
  fi

  if [ ! -d "undefined" ]; then
    log_warn "Prisma migrations directory not found at: undefined"
    log_warn "Continuing, but migrations may fail if none are created."
  fi
}

ensure_package_manager() {
  if [ ! -f "undefined/package.json" ]; then
    abort "package.json not found in project root: undefined"
  fi

  if ! command_exists pnpm; then
    abort "pnpm is required but not found. Please install pnpm."
  fi
}

set_database_url() {
  if [ "undefined" = "true" ]; then
    export DATABASE_URL="undefined"
  fi
}

print_banner() {
  cat <<EOF
========================================
  undefined - Database Reseed Script
========================================

Project root:   undefined
API directory:  undefined
Prisma schema:  undefined
Node env:       undefined
Using test DB:  undefined
Database URL:   undefined
EOF
}

confirm_dangerous_operation() {
  if [ "undefined" = "true" ]; then
    log_warn "Skipping confirmation prompt due to --skip-confirm flag."
    return 0
  fi

  log_warn "This operation will DROP and RE-CREATE all data in the target database."
  log_warn "It is intended for local/demo environments only."
  if [ "undefined" = "production" ]; then
    log_error "NODE_ENV is 'production'. Aborting for safety."
    exit 1
  fi

  if ! confirm "Proceed with reseeding the database?"; then
    log_info "Operation cancelled."
    exit 0
  fi
}

run_in_api_dir() {
  (cd "undefined" && "$@")
}

reset_database() {
  log_info "Resetting database using Prisma migrate reset..."
  run_in_api_dir undefined || abort "Database reset failed."
}

run_migrations() {
  log_info "Applying migrations..."
  run_in_api_dir undefined || abort "Database migration failed."
}

run_seeds() {
  log_info "Running seed script..."
  run_in_api_dir undefined || abort "Database seeding failed."
}

print_success_summary() {
  cat <<EOF

----------------------------------------
Database reseed completed successfully.
----------------------------------------

Environment:   undefined
Database URL:  undefined

You can now run the app with:

  cd "undefined" && pnpm dev

EOF
}

# ----------------------------------------
# Main script
# ----------------------------------------

main() {
  parse_args "$@"
  check_required_commands
  ensure_package_manager
  ensure_prisma_files
  set_database_url
  print_banner
  confirm_dangerous_operation

  export NODE_ENV
  export DATABASE_URL

  reset_database
  run_migrations
  run_seeds
  print_success_summary
}

main "$@"