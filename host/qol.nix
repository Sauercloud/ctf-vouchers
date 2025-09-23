{
  config,
  lib,
  ...
}:
{
  nix = {
    enable = true;

    settings = {
      use-xdg-base-directories = true;

      experimental-features = [
        "nix-command"
        "flakes"
      ];

      auto-optimise-store = true;
    };
  };
}
