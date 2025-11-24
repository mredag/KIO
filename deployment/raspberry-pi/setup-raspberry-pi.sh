#!/bin/bash

################################################################################
# Raspberry Pi Kiosk Setup Script
# For Raspberry Pi 5 with fresh Raspberry Pi OS
# 
# This script will:
# - Set static IP to 192.168.1.16
# - Install Node.js, PM2, and dependencies
# - Configure kiosk mode with Chromium
# - Deploy the application
# - Set up auto-start on boot
# - Configure system optimizations
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
STATIC_IP="192.168.1.16"
ROUTER_IP="192.168.1.1"
APP_USER="pi"
APP_DIR="/home/pi/spa-kiosk"
KIOSK_URL="http://localhost:3000"
NODE_VERSION="20"

################################################################################
# Helper Functions
################################################################################

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    if [ "$EUID" -eq 0 ]; then
        log_error "Please run this script as the pi user, not as root"
        exit 1
    fi
}

################################################################################
# System Update
################################################################################

update_system() {
    log_info "Updating system packages..."
    sudo apt-get update
    sudo apt-get upgrade -y
    log_success "System updated"
}

################################################################################
# Network Configuration
################################################################################

configure_static_ip() {
    log_info "Configuring static IP: $STATIC_IP"
    
    # Backup existing configuration
    if [ -f /etc/dhcpcd.conf ]; then
        sudo cp /etc/dhcpcd.conf /etc/dhcpcd.conf.backup
    fi
    
    # Configure static IP
    sudo tee -a /etc/dhcpcd.conf > /dev/null <<EOF

# Static IP Configuration for Kiosk
interface eth0
static ip_address=${STATIC_IP}/24
static routers=${ROUTER_IP}
static domain_name_servers=${ROUTER_IP} 8.8.8.8

interface wlan0
static ip_address=${STATIC_IP}/24
static routers=${ROUTER_IP}
static domain_name_servers=${ROUTER_IP} 8.8.8.8
EOF
    
    log_success "Static IP configured"
    log_warning "Network will be restarted at the end of installation"
}

################################################################################
# Install Dependencies
################################################################################

install_nodejs() {
    log_info "Installing Node.js ${NODE_VERSION}..."
    
    # Install Node.js using NodeSource
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    # Verify installation
    node --version
    npm --version
    
    log_success "Node.js installed"
}

install_system_dependencies() {
    log_info "Installing system dependencies..."
    
    sudo apt-get install -y \
        git \
        sqlite3 \
        chromium-browser \
        unclutter \
        xdotool \
        x11-xserver-utils \
        matchbox-window-manager \
        xautomation \
        sed \
        build-essential
    
    log_success "System dependencies installed"
}

install_pm2() {
    log_info "Installing PM2 process manager..."
    
    sudo npm install -g pm2
    
    # Configure PM2 to start on boot
    pm2 startup systemd -u $APP_USER --hp /home/$APP_USER
    sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $APP_USER --hp /home/$APP_USER
    
    log_success "PM2 installed and configured"
}

################################################################################
# Kiosk Configuration
################################################################################

configure_kiosk_autostart() {
    log_info "Configuring kiosk autostart..."
    
    # Create autostart directory
    mkdir -p /home/$APP_USER/.config/autostart
    
    # Create kiosk autostart file
    cat > /home/$APP_USER/.config/autostart/kiosk.desktop <<EOF
[Desktop Entry]
Type=Application
Name=Kiosk
Exec=/home/$APP_USER/start-kiosk.sh
X-GNOME-Autostart-enabled=true
EOF
    
    log_success "Kiosk autostart configured"
}

create_kiosk_startup_script() {
    log_info "Creating kiosk startup script..."
    
    cat > /home/$APP_USER/start-kiosk.sh <<'EOF'
#!/bin/bash

# Wait for network
sleep 10

# Disable screen blanking
xset s off
xset -dpms
xset s noblank

# Hide cursor
unclutter -idle 0.1 -root &

# Start window manager
matchbox-window-manager -use_titlebar no &

# Wait for backend to be ready
while ! curl -s http://localhost:3001/api/kiosk/health > /dev/null; do
    echo "Waiting for backend..."
    sleep 2
done

# Start Chromium in kiosk mode
chromium-browser \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --no-first-run \
    --fast \
    --fast-start \
    --disable-features=TranslateUI \
    --disable-translate \
    --disable-session-crashed-bubble \
    --check-for-update-interval=31536000 \
    --disable-pinch \
    --overscroll-history-navigation=0 \
    --disable-background-timer-throttling \
    --disable-backgrounding-occluded-windows \
    --disable-renderer-backgrounding \
    --disable-features=IsolateOrigins,site-per-process \
    http://localhost:3000
EOF
    
    chmod +x /home/$APP_USER/start-kiosk.sh
    
    log_success "Kiosk startup script created"
}

configure_boot_config() {
    log_info "Configuring boot settings..."
    
    # Disable splash screen and enable fast boot
    sudo sed -i 's/console=tty1/console=tty3 loglevel=3 quiet splash vt.global_cursor_default=0/' /boot/cmdline.txt
    
    # GPU memory allocation
    if ! grep -q "gpu_mem=" /boot/config.txt; then
        echo "gpu_mem=256" | sudo tee -a /boot/config.txt
    fi
    
    # Disable screen blanking in boot config
    if ! grep -q "hdmi_blanking=1" /boot/config.txt; then
        echo "hdmi_blanking=1" | sudo tee -a /boot/config.txt
    fi
    
    log_success "Boot configuration updated"
}

disable_screen_blanking() {
    log_info "Disabling screen blanking..."
    
    # Create X11 config
    sudo mkdir -p /etc/X11/xorg.conf.d
    sudo tee /etc/X11/xorg.conf.d/10-monitor.conf > /dev/null <<EOF
Section "ServerLayout"
    Identifier "ServerLayout0"
    Option "BlankTime" "0"
    Option "StandbyTime" "0"
    Option "SuspendTime" "0"
    Option "OffTime" "0"
EndSection
EOF
    
    log_success "Screen blanking disabled"
}

################################################################################
# Application Deployment
################################################################################

clone_or_update_repo() {
    log_info "Setting up application..."
    
    if [ -d "$APP_DIR" ]; then
        log_info "Application directory exists, pulling latest changes..."
        cd $APP_DIR
        git pull
    else
        log_info "Cloning application repository..."
        # Replace with your actual repository URL
        log_warning "Please clone your repository manually to $APP_DIR"
        log_warning "Or update this script with your repository URL"
        mkdir -p $APP_DIR
    fi
    
    cd $APP_DIR
}

setup_backend() {
    log_info "Setting up backend..."
    
    cd $APP_DIR/backend
    
    # Install dependencies
    npm install --production
    
    # Create .env file if it doesn't exist
    if [ ! -f .env ]; then
        cp .env.example .env
        log_warning "Please configure backend/.env file"
    fi
    
    # Create data directory
    mkdir -p ../data/backups
    
    # Build backend
    npm run build
    
    log_success "Backend setup complete"
}

setup_frontend() {
    log_info "Setting up frontend..."
    
    cd $APP_DIR/frontend
    
    # Install dependencies
    npm install
    
    # Build frontend
    npm run build
    
    # Copy build to backend public directory
    rm -rf ../backend/public
    cp -r dist ../backend/public
    
    log_success "Frontend setup complete"
}

configure_pm2() {
    log_info "Configuring PM2..."
    
    cd $APP_DIR
    
    # Stop existing processes
    pm2 delete all || true
    
    # Start backend with PM2
    cd backend
    pm2 start npm --name "kiosk-backend" -- run start
    
    # Save PM2 configuration
    pm2 save
    
    log_success "PM2 configured and backend started"
}

################################################################################
# System Optimizations
################################################################################

optimize_system() {
    log_info "Applying system optimizations..."
    
    # Disable unnecessary services
    sudo systemctl disable bluetooth.service
    sudo systemctl disable hciuart.service
    sudo systemctl disable avahi-daemon.service
    
    # Increase swap for better performance
    sudo dphys-swapfile swapoff
    sudo sed -i 's/CONF_SWAPSIZE=100/CONF_SWAPSIZE=2048/' /etc/dphys-swapfile
    sudo dphys-swapfile setup
    sudo dphys-swapfile swapon
    
    log_success "System optimizations applied"
}

################################################################################
# Watchdog Setup
################################################################################

setup_watchdog() {
    log_info "Setting up watchdog service..."
    
    # Copy watchdog script
    cp $APP_DIR/deployment/raspberry-pi/watchdog-kiosk.sh /home/$APP_USER/watchdog-kiosk.sh
    chmod +x /home/$APP_USER/watchdog-kiosk.sh
    
    # Create systemd service
    sudo tee /etc/systemd/system/kiosk-watchdog.service > /dev/null <<EOF
[Unit]
Description=Kiosk Watchdog Service
After=network.target

[Service]
Type=simple
User=$APP_USER
ExecStart=/home/$APP_USER/watchdog-kiosk.sh
Restart=always
RestartSec=60

[Install]
WantedBy=multi-user.target
EOF
    
    sudo systemctl daemon-reload
    sudo systemctl enable kiosk-watchdog.service
    sudo systemctl start kiosk-watchdog.service
    
    log_success "Watchdog service configured"
}

################################################################################
# Backup Configuration
################################################################################

setup_backup_cron() {
    log_info "Setting up automatic backups..."
    
    # Add cron job for daily backups at 2 AM
    (crontab -l 2>/dev/null; echo "0 2 * * * $APP_DIR/deployment/raspberry-pi/backup-database.sh") | crontab -
    
    log_success "Automatic backups configured"
}

################################################################################
# Verification
################################################################################

verify_installation() {
    log_info "Verifying installation..."
    
    # Check Node.js
    if command -v node &> /dev/null; then
        log_success "Node.js: $(node --version)"
    else
        log_error "Node.js not found"
    fi
    
    # Check PM2
    if command -v pm2 &> /dev/null; then
        log_success "PM2: $(pm2 --version)"
    else
        log_error "PM2 not found"
    fi
    
    # Check Chromium
    if command -v chromium-browser &> /dev/null; then
        log_success "Chromium installed"
    else
        log_error "Chromium not found"
    fi
    
    # Check application directory
    if [ -d "$APP_DIR" ]; then
        log_success "Application directory exists"
    else
        log_error "Application directory not found"
    fi
    
    # Check PM2 processes
    log_info "PM2 processes:"
    pm2 list
}

################################################################################
# Main Installation Flow
################################################################################

main() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║     Raspberry Pi Kiosk Setup Script                        ║"
    echo "║     For Raspberry Pi 5 with Raspberry Pi OS                ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    
    check_root
    
    log_info "Starting installation..."
    log_warning "This will take 15-30 minutes depending on your internet speed"
    echo ""
    
    read -p "Continue with installation? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Installation cancelled"
        exit 0
    fi
    
    # System setup
    update_system
    configure_static_ip
    
    # Install dependencies
    install_nodejs
    install_system_dependencies
    install_pm2
    
    # Kiosk configuration
    configure_kiosk_autostart
    create_kiosk_startup_script
    configure_boot_config
    disable_screen_blanking
    
    # Application deployment
    clone_or_update_repo
    setup_backend
    setup_frontend
    configure_pm2
    
    # System optimizations
    optimize_system
    setup_watchdog
    setup_backup_cron
    
    # Verification
    verify_installation
    
    echo ""
    log_success "═══════════════════════════════════════════════════════════"
    log_success "Installation complete!"
    log_success "═══════════════════════════════════════════════════════════"
    echo ""
    log_info "Next steps:"
    echo "  1. Configure backend/.env file if needed"
    echo "  2. Reboot the system: sudo reboot"
    echo "  3. After reboot, kiosk will start automatically"
    echo ""
    log_info "Useful commands:"
    echo "  - Check backend status: pm2 status"
    echo "  - View backend logs: pm2 logs kiosk-backend"
    echo "  - Restart backend: pm2 restart kiosk-backend"
    echo "  - Access admin panel: http://${STATIC_IP}:3001/admin"
    echo ""
    log_warning "Please reboot now: sudo reboot"
}

# Run main installation
main
