#!/usr/bin/env bash
nix run nixpkgs#nixos-rebuild -- switch --fast --flake .#server \
    --target-host root@ctf-vouchers.de \
    --build-host root@ctf-vouchers.de