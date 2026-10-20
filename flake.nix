{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";

    sops-nix = {
      url = "github:Mic92/sops-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    disko = {
      url = "github:nix-community/disko";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      sops-nix,
      disko,
    }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs {
        inherit system;
        overlays = [
          (final: prev: {
            vouchers = prev.callPackage ./package.nix { };
          })
        ];
      };
    in
    {
      nixosConfigurations.server = nixpkgs.lib.nixosSystem rec {
        inherit system pkgs;
        modules = [
          sops-nix.nixosModules.sops
          disko.nixosModules.disko
          ./host/disko.nix
          ./host/hardware-configuration.nix
          ./host/system.nix
          ./host/qol.nix
          ./host/sops.nix
          ./host/postgres.nix
          ./host/nginx.nix
          ./host/vouchers.nix
          ./host/grafana.nix
          ./host/prometheus.nix
        ];
      };
      devShells.${system}.default = pkgs.mkShell {
        sopsPGPKeyDirs = [ "${toString ./.}/keys" ];

        nativeBuildInputs = [
          (pkgs.callPackage sops-nix { }).sops-import-keys-hook
          pkgs.yarn
          pkgs.nodejs
        ];
      };
      packages.${system}.default = pkgs.callPackage ./package.nix { };
      formatter.${system} = pkgs.nixfmt-tree;
    };
}
