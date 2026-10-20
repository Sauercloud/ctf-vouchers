{
  config,
  lib,
  inputs,
  ...
}:
{
  boot.loader.grub.enable = true;
  # Install for UEFI too, as the fallback loader (no NVRAM entry needed).
  boot.loader.grub.efiSupport = true;
  boot.loader.grub.efiInstallAsRemovable = true;
  boot.tmp.cleanOnBoot = true;

  networking.hostName = "ctf-vouchers";

  services.openssh.enable = true;
  users.users.root.openssh.authorizedKeys.keys = [
    "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKcN6c6/8qYVjxWi39CVju6ecKHZZcqYQhgHA+MR4Wg9 localo"
    "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFZPYF6pCjSFVkxJOMw1DuiFaXoDfa2lynxVu+/u5Qu2 D_K"
  ];

  networking.nftables.enable = true;

  # The server has 1 GB of RAM, next + postgres + grafana + prometheus need more.
  swapDevices = [
    {
      device = "/var/lib/swapfile";
      size = 2048;
    }
  ];

  system.stateVersion = "23.11";
}
