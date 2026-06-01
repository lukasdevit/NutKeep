#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  UFW Firewall Hardening
#  Blocks direct HTTP/S from non-Cloudflare IPs.
#  Restricts SSH to your IP only.
# ═══════════════════════════════════════════════════════════════
set -e

# ── CONFIGURE THESE ──
YOUR_HOME_IP=""           # Your static home/office IP for SSH access (e.g. "1.2.3.4")
SSH_PORT="2222"           # Your SSH port

if [[ -z "$YOUR_HOME_IP" ]]; then
  echo "❌ Set YOUR_HOME_IP at the top of this script before running."
  echo "   Get it from: curl -s https://ifconfig.me"
  exit 1
fi

echo "🔒 Setting up UFW firewall..."

# ── Default: deny all incoming, allow all outgoing ──
ufw default deny incoming
ufw default allow outgoing

# ── SSH: ONLY from your IP ──
ufw allow from "$YOUR_HOME_IP" to any port "$SSH_PORT" proto tcp
echo "✅ SSH ($SSH_PORT) restricted to $YOUR_HOME_IP"

# ── HTTP/S: ONLY from Cloudflare IPs ──
CLOUDFLARE_IPS=(
  "173.245.48.0/20"
  "103.21.244.0/22"
  "103.22.200.0/22"
  "103.31.4.0/22"
  "141.101.64.0/18"
  "108.162.192.0/18"
  "190.93.240.0/20"
  "188.114.96.0/20"
  "197.234.240.0/22"
  "198.41.128.0/17"
  "162.158.0.0/15"
  "104.16.0.0/13"
  "104.24.0.0/14"
  "172.64.0.0/13"
  "131.0.72.0/22"
)

for ip in "${CLOUDFLARE_IPS[@]}"; do
  ufw allow from "$ip" to any port 80,443 proto tcp
done
echo "✅ HTTP/HTTPS (80/443) restricted to Cloudflare IPs only"

# ── Cloudflare IPv6 ranges ──
CLOUDFLARE_IPS_V6=(
  "2400:cb00::/32"
  "2606:4700::/32"
  "2803:f800::/32"
  "2405:b500::/32"
  "2405:8100::/32"
  "2a06:98c0::/29"
  "2c0f:f248::/32"
)

for ip in "${CLOUDFLARE_IPS_V6[@]}"; do
  ufw allow from "$ip" to any port 80,443 proto tcp
done
echo "✅ HTTP/HTTPS (80/443) restricted to Cloudflare IPv6 IPs"

# ── Enable firewall ──
ufw --force enable

echo ""
echo "🎉 Firewall is active. Current rules:"
ufw status numbered
