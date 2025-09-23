{ lib, ... }:
{
  services.postgresql = {
    enable = true;

    ensureDatabases = [ "vouchers" ];
    ensureUsers = [
      {
        name = "vouchers";
        ensureDBOwnership = true;
      }
    ];
    authentication = lib.mkOverride 10 ''
      #type database  DBuser  auth-method
      local all       all     trust
    '';
  };
}
