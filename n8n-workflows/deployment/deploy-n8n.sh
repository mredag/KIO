#!/bin/bash
# deploy-n8n.sh - Deploy n8n workflow automation to Raspberry Pi
# This script installs n8n, configures systemd service, and sets up reverse proxy

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
N8N_USER="n8n"
N8N_HOME="/var/lib/n8n"
N8N_LOGS="$N8N_HOME/logs"
SERVICE_FILE="n8n.service"
NGINX_CONFIG="nginx-n8n.conf"
CADDY_CONFIG="Caddyfile-n8n"

# Functions
print_step() {
    echo -e "${GREEN}==>${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}WARNING:${NC} $1"
}

print_error() {
    echo -e "${RED}ERROR:${NC} $1"
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        echo "Install Node.js 20.x first:"
        echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
        echo "  sudo apt-get install -y nodejs"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_warning "Node.js version is $NODE_VERSION, but 18+ is recommended"
    fi
}

create_user() {
    print_step "Creating n8n user..."
    
    if id "$N8N_USER" &>/dev/null; then
        print_warning "User $N8N_USER already exists, skipping"
    else
        useradd -m -s /bin/bash "$N8N_USER"
        echo "✓ User $N8N_USER created"
    fi
}

create_directories() {
    print_step "Creating directories..."
    
    mkdir -p "$N8N_HOME"
    mkdir -p "$N8N_LOGS"
    chown -R "$N8N_USER:$N8N_USER" "$N8N_HOME"
    
    echo "✓ Directories created at $N8N_HOME"
}

install_n8n() {
    print_step "Installing n8n globally..."
    
    if command -v n8n &> /dev/null; then
        CURRENT_VERSION=$(n8n --version 2>/dev/null || echo "unknown")
        print_warning "n8n is already installed (version: $CURRENT_VERSION)"
        read -p "Do you want to update n8n? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "✓ Skipping n8n installation"
            return
        fi
    fi
    
    npm install -g n8n
    echo "✓ n8n installed: $(n8n --version)"
}

install_service() {
    print_step "Installing systemd service..."
    
    if [ ! -f "$SERVICE_FILE" ]; then
        print_error "Service file $SERVICE_FILE not found in current directory"
        exit 1
    fi
    
    # Backup existing service if present
    if [ -f "/etc/systemd/system/n8n.service" ]; then
        cp /etc/systemd/system/n8n.service /etc/systemd/system/n8n.service.backup
        print_warning "Backed up existing service to n8n.service.backup"
    fi
    
    # Copy service file
    cp "$SERVICE_FILE" /etc/systemd/system/n8n.service
    
    # Prompt for configuration
    echo ""
    echo "Please configure the following in /etc/systemd/system/n8n.service:"
    echo "  1. N8N_BASIC_AUTH_PASSWORD (change from 'changeme')"
    echo "  2. WEBHOOK_URL (set to your public domain)"
    echo ""
    read -p "Press Enter to edit the service file now, or Ctrl+C to exit and edit manually..."
    ${EDITOR:-nano} /etc/systemd/system/n8n.service
    
    # Reload systemd
    systemctl daemon-reload
    echo "✓ Service installed"
}

enable_service() {
    print_step "Enabling and starting n8n service..."
    
    systemctl enable n8n
    systemctl start n8n
    
    # Wait for service to start
    sleep 3
    
    if systemctl is-active --quiet n8n; then
        echo "✓ n8n service is running"
        systemctl status n8n --no-pager -l
    else
        print_error "n8n service failed to start"
        echo "Check logs with: sudo journalctl -u n8n -n 50"
        exit 1
    fi
}

configure_reverse_proxy() {
    print_step "Configuring reverse proxy..."
    
    echo "Choose reverse proxy:"
    echo "  1) nginx"
    echo "  2) Caddy"
    echo "  3) Skip (configure manually later)"
    read -p "Enter choice (1-3): " -n 1 -r
    echo
    
    case $REPLY in
        1)
            configure_nginx
            ;;
        2)
            configure_caddy
            ;;
        3)
            print_warning "Skipping reverse proxy configuration"
            echo "Configure manually using $NGINX_CONFIG or $CADDY_CONFIG"
            ;;
        *)
            print_warning "Invalid choice, skipping reverse proxy configuration"
            ;;
    esac
}

configure_nginx() {
    print_step "Configuring nginx..."
    
    # Check if nginx is installed
    if ! command -v nginx &> /dev/null; then
        echo "Installing nginx..."
        apt-get update
        apt-get install -y nginx certbot python3-certbot-nginx
    fi
    
    if [ ! -f "$NGINX_CONFIG" ]; then
        print_error "nginx config file $NGINX_CONFIG not found"
        return 1
    fi
    
    # Copy config
    cp "$NGINX_CONFIG" /etc/nginx/sites-available/n8n
    
    # Prompt for domain
    read -p "Enter your domain (e.g., n8n.yourdomain.com): " DOMAIN
    
    # Replace domain in config
    sed -i "s/n8n.yourdomain.com/$DOMAIN/g" /etc/nginx/sites-available/n8n
    
    # Enable site
    ln -sf /etc/nginx/sites-available/n8n /etc/nginx/sites-enabled/
    
    # Test config
    if nginx -t; then
        echo "✓ nginx configuration is valid"
    else
        print_error "nginx configuration test failed"
        return 1
    fi
    
    # Reload nginx
    systemctl reload nginx
    
    echo ""
    echo "nginx configured. To obtain SSL certificate, run:"
    echo "  sudo certbot --nginx -d $DOMAIN"
    echo ""
}

configure_caddy() {
    print_step "Configuring Caddy..."
    
    # Check if Caddy is installed
    if ! command -v caddy &> /dev/null; then
        echo "Installing Caddy..."
        apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
        apt-get update
        apt-get install -y caddy
    fi
    
    if [ ! -f "$CADDY_CONFIG" ]; then
        print_error "Caddy config file $CADDY_CONFIG not found"
        return 1
    fi
    
    # Prompt for domain
    read -p "Enter your domain (e.g., n8n.yourdomain.com): " DOMAIN
    
    # Copy and modify config
    cp "$CADDY_CONFIG" /etc/caddy/Caddyfile
    sed -i "s/n8n.yourdomain.com/$DOMAIN/g" /etc/caddy/Caddyfile
    
    # Reload Caddy (automatically obtains SSL certificate)
    systemctl reload caddy
    
    echo "✓ Caddy configured with automatic HTTPS"
}

test_webhook() {
    print_step "Testing webhook endpoint..."
    
    # Wait for n8n to be fully ready
    sleep 5
    
    # Test local endpoint
    if curl -f -s http://localhost:5678/healthz > /dev/null 2>&1; then
        echo "✓ n8n is responding on localhost:5678"
    else
        print_warning "n8n health check failed on localhost:5678"
        echo "Check logs with: sudo journalctl -u n8n -n 50"
    fi
}

print_next_steps() {
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}n8n Deployment Complete!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "Next steps:"
    echo ""
    echo "1. Access n8n UI:"
    echo "   - Local: http://localhost:5678"
    echo "   - Public: https://your-domain.com (after DNS and SSL setup)"
    echo ""
    echo "2. Import workflows:"
    echo "   - In n8n UI: Import from File"
    echo "   - Import files from: ../workflows/*.json"
    echo ""
    echo "3. Configure credentials:"
    echo "   - See: ../docs/credentials-setup.md"
    echo "   - Add Backend API Key"
    echo "   - Add WhatsApp Business API credentials"
    echo ""
    echo "4. Configure WhatsApp webhook in Meta dashboard:"
    echo "   - Webhook URL: https://your-domain.com/webhook/whatsapp"
    echo "   - Verify token: (set in n8n workflow)"
    echo "   - Subscribe to 'messages' field"
    echo ""
    echo "5. Test workflows:"
    echo "   - Run: ./test-webhooks.sh"
    echo "   - Send test WhatsApp message"
    echo ""
    echo "6. Monitor service:"
    echo "   - Status: sudo systemctl status n8n"
    echo "   - Logs: sudo journalctl -u n8n -f"
    echo "   - n8n logs: sudo tail -f $N8N_LOGS/n8n.log"
    echo ""
    echo "7. Setup automated backups:"
    echo "   - Run: sudo crontab -e"
    echo "   - Add: 30 2 * * * $(pwd)/backup.sh"
    echo ""
}

# Main execution
main() {
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}n8n Deployment Script for Raspberry Pi${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    
    check_root
    check_node
    
    create_user
    create_directories
    install_n8n
    install_service
    enable_service
    configure_reverse_proxy
    test_webhook
    
    print_next_steps
}

# Run main function
main
