#!/bin/bash
#
# Workspace setup script for Conductor
# This script prepares the environment for parallel agent execution
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the correct directory
if [ ! "$(pwd)" = "/Users/hcheng/conductor/workspaces/bestuur/seattle" ]; then
    print_error "Not in the correct directory. Expected: /Users/hcheng/conductor/workspaces/bestuur/seattle"
    exit 1
fi

print_info "Setting up workspace for Conductor..."

# Install dependencies
print_info "Installing dependencies..."
if [ -f "package.json" ]; then
    npm ci --production
    print_info "Dependencies installed successfully."
else
    print_error "package.json not found!"
    exit 1
fi

# Initialize Prisma client
print_info "Initializing Prisma client..."
if [ -f "prisma/contract.prisma" ]; then
    npx prisma contract:emit
    print_info "Prisma client initialized."
else
    print_warning "prisma/contract.prisma not found. Skipping Prisma initialization."
fi

# Setup environment variables
print_info "Configuring environment..."
export DATABASE_URL="${DATABASE_URL:-}"
export AUTH0_DOMAIN="${AUTH0_DOMAIN:-}"
export AUTH0_M2M_CLIENT_ID="${AUTH0_M2M_CLIENT_ID:-}"
export AUTH0_M2M_CLIENT_SECRET="${AUTH0_M2M_CLIENT_SECRET:-}"
export FOYS_API_KEY="${FOYS_API_KEY:-}"

# Create .context directory if it doesn't exist
if [ ! -d ".context" ]; then
    print_info "Creating .context directory for agent collaboration..."
    mkdir -p .context
fi

# Ensure .context is writable
chmod 755 .context

print_info "Workspace setup complete!"
echo ""
echo "Next steps:"
echo "  1. Run 'npm run dev' to start the development server"
echo "  2. Agents can now run in parallel using Conductor"
echo "  3. Use the .context directory for inter-agent file sharing"
echo ""
