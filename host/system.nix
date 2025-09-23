{
  config,
  lib,
  inputs,
  ...
}:
{
  boot.loader.grub.enable = true;
  boot.tmp.cleanOnBoot = true;

  networking.hostName = "ctf-vouchers";

  services.openssh.enable = true;
  users.users.root.openssh.authorizedKeys.keys = [
    "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKcN6c6/8qYVjxWi39CVju6ecKHZZcqYQhgHA+MR4Wg9 localo"
    "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFZPYF6pCjSFVkxJOMw1DuiFaXoDfa2lynxVu+/u5Qu2 D_K"
  ];

  networking.nftables.enable = true;

  system.stateVersion = "23.11";
}
