#!/usr/bin/env bash
# Reinstalls the server from scratch with nixos-anywhere + disko.
# THIS WIPES /dev/sda on the target.
#
# The SSH host key is carried over, so the server's sops age recipient in
# .sops.yaml stays valid. The old database is dumped locally first.
#
# The kexec installer does not fit into the 1 GB of RAM: rescale the server
# to a bigger type first ("CPU and RAM only", so it can be scaled back down).
set -euo pipefail

host=${1:-root@ctf-vouchers.de}

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# install -d -m 755 "$tmp/etc/ssh"
# scp "$host:/etc/ssh/ssh_host_ed25519_key" "$host:/etc/ssh/ssh_host_ed25519_key.pub" "$tmp/etc/ssh/"
# chmod 600 "$tmp/etc/ssh/ssh_host_ed25519_key"

# ssh "$host" 'runuser -u postgres -- pg_dump vouchers' >"vouchers-backup-$(date +%F).sql"

nix run github:nix-community/nixos-anywhere -- \
  --flake .#server \
  --extra-files "$tmp" \
  --build-on local \
  "$host"
