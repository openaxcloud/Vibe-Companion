#!/bin/bash

###############################################################################
# API Keys Configuration Script
# Retrieves API keys from Replit Secrets and configures environment
###############################################################################

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║           API Keys Configuration - Replit Secrets              ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check if running in Replit environment
if [ -n "$REPL_ID" ]; then
    echo "✓ Running in Replit environment (REPL_ID: $REPL_ID)"
else
    echo "⚠ Not running in Replit environment - using local .env only"
fi

echo ""
echo "Checking for API keys..."
echo ""

# Check and report on each API key
check_api_key() {
    local key_name=$1
    local key_value=$(printenv "$key_name")

    if [ -n "$key_value" ]; then
        local masked="${key_value:0:8}...${key_value: -4}"
        echo "✓ $key_name: $masked"
        return 0
    else
        echo "✗ $key_name: NOT SET"
        return 1
    fi
}

# AI Provider API Keys
echo "─────────────────────────────────────────────────────────────────"
echo "AI Provider API Keys:"
echo "─────────────────────────────────────────────────────────────────"

check_api_key "OPENAI_API_KEY"
check_api_key "ANTHROPIC_API_KEY"
check_api_key "GEMINI_API_KEY"
check_api_key "XAI_API_KEY"
check_api_key "GROQ_API_KEY"
check_api_key "MOONSHOT_API_KEY"

echo ""
echo "─────────────────────────────────────────────────────────────────"
echo "Other API Keys:"
echo "─────────────────────────────────────────────────────────────────"

check_api_key "STRIPE_SECRET_KEY"
check_api_key "STRIPE_WEBHOOK_SECRET"
check_api_key "SENDGRID_API_KEY"
check_api_key "GITHUB_TOKEN"

echo ""
echo "─────────────────────────────────────────────────────────────────"
echo "Configuration Summary:"
echo "─────────────────────────────────────────────────────────────────"

# Count configured keys
total=0
configured=0

for key in "OPENAI_API_KEY" "ANTHROPIC_API_KEY" "GEMINI_API_KEY" "XAI_API_KEY" "GROQ_API_KEY" "MOONSHOT_API_KEY"; do
    total=$((total + 1))
    if [ -n "$(printenv "$key")" ]; then
        configured=$((configured + 1))
    fi
done

echo "AI Providers: $configured / $total configured"

if [ $configured -eq 0 ]; then
    echo ""
    echo "⚠️  WARNING: No AI provider API keys are configured!"
    echo ""
    echo "To configure API keys in Replit:"
    echo "1. Click the 'Secrets' tab in the left sidebar (🔒)"
    echo "2. Add your API keys:"
    echo "   - OPENAI_API_KEY=sk-..."
    echo "   - ANTHROPIC_API_KEY=sk-ant-..."
    echo "   - GEMINI_API_KEY=..."
    echo "   - XAI_API_KEY=..."
    echo "   - GROQ_API_KEY=..."
    echo ""
    echo "3. Restart the application to load the new keys"
    echo ""
elif [ $configured -lt $total ]; then
    echo ""
    echo "ℹ️  Some AI providers are not configured"
    echo "   The application will work with configured providers only"
    echo ""
else
    echo ""
    echo "✓ All AI providers configured!"
    echo ""
fi

echo "═════════════════════════════════════════════════════════════════"
