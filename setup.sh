#!/bin/bash

# StreamWeaver Setup Script for Linux/macOS

set -e  # Exit on error

echo "🚀 StreamWeaver Development Setup"
echo "=================================="

# Check Node.js version
echo "✓ Checking Node.js version..."
NODE_VERSION=$(node -v)
echo "  Node.js $NODE_VERSION found"

# Check npm version
echo "✓ Checking npm version..."
NPM_VERSION=$(npm -v)
echo "  npm $NPM_VERSION found"

# Create environment files if they don't exist
echo "✓ Setting up environment files..."

if [ ! -f "backend_backup/.env" ]; then
    cp backend_backup/.env.example backend_backup/.env
    echo "  Created backend_backup/.env"
fi

if [ ! -f "client/.env" ]; then
    cp client/.env.example client/.env
    echo "  Created client/.env"
fi

# Install dependencies
echo "✓ Installing dependencies..."
npm install

# Create uploads directory
echo "✓ Creating uploads directory..."
mkdir -p backend_backup/uploads

# Setup Git hooks
echo "✓ Setting up Git hooks..."
if [ -d ".git" ]; then
    mkdir -p .git/hooks
    # Add pre-commit hook for linting (optional)
    cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
npm run lint --workspace=@streamweaver/backend 2>/dev/null || true
EOF
    chmod +x .git/hooks/pre-commit
    echo "  Git hooks installed"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit environment files:"
echo "   - backend_backup/.env"
echo "   - client/.env"
echo ""
echo "2. Start development server:"
echo "   npm run dev"
echo ""
echo "3. Or use Docker Compose:"
echo "   docker-compose up -d"
echo ""
echo "📚 See SETUP.md for detailed instructions"
