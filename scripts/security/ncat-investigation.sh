#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Suspicious Port 443 (ncat) Investigation
#  Run this ON THE SERVER
# ═══════════════════════════════════════════════════════════════
set -e

echo "══════════════════════════════════════════"
echo " 🔍 PORT 443 / NCAT INVESTIGATION"
echo "══════════════════════════════════════════"
echo ""

# ── 1. What's listening on 443 ──
echo "── 1. Processes on port 443 ──"
ss -tlnp | grep -E ':443|LISTEN' || echo "(no results)"
echo ""

echo "── 2. Open files on port 443 ──"
lsof -i :443 2>/dev/null || echo "(no results — run as root)"
echo ""

# ── 2. Check for ncat/nc processes ──
echo "── 3. ncat / nc processes ──"
ps aux | grep -iE 'ncat|nc ' | grep -v grep || echo "(no ncat/nc processes found)"
echo ""

# ── 3. Check Docker — is Caddy actually on 443? ──
echo "── 4. Docker port mappings ──"
docker ps --format "table {{.Names}}\t{{.Ports}}" 2>/dev/null || echo "(Docker not running or not accessible)"
echo ""

echo "── 5. Docker processes on host port 443 ──"
docker inspect $(docker ps -q) 2>/dev/null | grep -A2 '"443/tcp"' || echo "(no Docker container exposing 443 found)"
echo ""

# ── 4. Suspicious cron jobs ──
echo "── 6. User crontab ──"
crontab -l 2>/dev/null || echo "(no crontab for current user)"
echo ""

echo "── 7. System crontabs ──"
for f in /etc/crontab /etc/cron.d/* /etc/cron.hourly/* /etc/cron.daily/* /etc/cron.weekly/* /etc/cron.monthly/*; do
  [[ -f "$f" ]] && echo "  $f:" && cat "$f" 2>/dev/null
done
echo ""

# ── 5. Suspicious systemd services ──
echo "── 8. User systemd services (non-standard) ──"
systemctl list-units --type=service --state=running 2>/dev/null | grep -v -E 'systemd|docker|containerd|ssh|cron|dbus|polkit|NetworkManager|systemd|getty|serial|user@|session|snapd|cloud-init|snap\.' || echo "(no results)"
echo ""

# ── 6. Recent auth activity ──
echo "── 9. Last 10 logins ──"
last -10 2>/dev/null || echo "(no wtmp)"
echo ""

echo "── 10. Failed SSH attempts (last 20) ──"
grep "Failed password" /var/log/auth.log 2>/dev/null | tail -20 || journalctl -u ssh -n 20 --no-pager 2>/dev/null || echo "(no auth log accessible)"
echo ""

# ── 7. Listening ports summary ──
echo "── 11. All listening TCP ports ──"
ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null
echo ""

# ── 8. Check for unexpected SUID binaries ──
echo "── 12. Recently modified binaries (last 7 days) ──"
find /usr/bin /usr/sbin /bin /sbin -type f -mtime -7 -ls 2>/dev/null | head -20 || echo "(no suspicious recent binaries)"
echo ""

echo "══════════════════════════════════════════"
echo " ✅ Investigation complete."
echo "   If you see unexpected ncat/nc processes,"
echo "   unknown cron jobs, or unfamiliar services:"
echo "   ASSUME COMPROMISE and rebuild the server."
echo "══════════════════════════════════════════"
