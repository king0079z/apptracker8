#!/bin/bash
# client-installer/scripts/postremove.sh
# Post-removal script for Enterprise Monitor Client on Linux

set -e

# Variables
SERVICE_NAME="enterprise-monitor-client"
INSTALL_DIR="/opt/enterprise-monitor-client"
LOG_DIR="/var/log/enterprise-monitor-client"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

echo "Removing Enterprise Monitor Client..."

# Stop and disable service
if systemctl is-active --quiet "$SERVICE_NAME"; then
    systemctl stop "$SERVICE_NAME"
fi

if systemctl is-enabled --quiet "$SERVICE_NAME"; then
    systemctl disable "$SERVICE_NAME"
fi

# Remove service file
rm -f "$SERVICE_FILE"

# Reload systemd
systemctl daemon-reload

# Remove firewall rules (if ufw is installed)
if command -v ufw &> /dev/null; then
    echo "Removing firewall rules..."
    ufw delete allow 9876/tcp || true
fi

# Ask about removing data
if [ -d "$LOG_DIR" ]; then
    echo ""
    read -p "Remove log files? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$LOG_DIR"
        echo "Log files removed."
    else
        echo "Log files preserved at: $LOG_DIR"
    fi
fi

echo "Enterprise Monitor Client removal completed!"