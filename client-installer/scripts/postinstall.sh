#!/bin/bash
# client-installer/scripts/postinstall.sh
# Post-installation script for Enterprise Monitor Client on Linux

set -e

# Variables
SERVICE_NAME="enterprise-monitor-client"
INSTALL_DIR="/opt/enterprise-monitor-client"
CONFIG_DIR="$INSTALL_DIR/config"
LOG_DIR="/var/log/enterprise-monitor-client"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

echo "Configuring Enterprise Monitor Client..."

# Create necessary directories
mkdir -p "$CONFIG_DIR"
mkdir -p "$LOG_DIR"

# Set permissions
chmod 755 "$INSTALL_DIR"
chmod 755 "$CONFIG_DIR"
chmod 755 "$LOG_DIR"

# Create systemd service file
cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Enterprise Monitor Client
After=network.target

[Service]
Type=simple
ExecStart=$INSTALL_DIR/enterprise-client
Restart=always
RestartSec=10
User=root
WorkingDirectory=$INSTALL_DIR
StandardOutput=append:$LOG_DIR/client.log
StandardError=append:$LOG_DIR/client-error.log

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
systemctl daemon-reload

# Enable and start service
systemctl enable "$SERVICE_NAME"
systemctl start "$SERVICE_NAME"

# Configure firewall (if ufw is installed)
if command -v ufw &> /dev/null; then
    echo "Configuring firewall..."
    ufw allow 9876/tcp comment "Enterprise Monitor Client" || true
fi

# Configure iptables (if no ufw)
if ! command -v ufw &> /dev/null && command -v iptables &> /dev/null; then
    echo "Configuring iptables..."
    iptables -A INPUT -p tcp --dport 9876 -j ACCEPT || true
    
    # Save iptables rules
    if command -v iptables-save &> /dev/null; then
        iptables-save > /etc/iptables/rules.v4 || true
    fi
fi

echo "Enterprise Monitor Client installation completed!"
echo "Service status: $(systemctl is-active $SERVICE_NAME)"
echo ""
echo "Configuration file: $CONFIG_DIR/client-config.json"
echo "Logs: $LOG_DIR/"
echo ""
echo "To check service status: systemctl status $SERVICE_NAME"
echo "To view logs: journalctl -u $SERVICE_NAME -f"