{
  lib,
  config,
  pkgs,
  ...
}:
{
  systemd.services.vouchers = {
    wantedBy = [ "multi-user.target" ];
    after = [ "network.target" ];
    environment = {
      DATABASE_URL = "postgresql://vouchers@localhost/vouchers?host=/run/postgresql";
      NEXTAUTH_URL = "https://ctf-vouchers.de";
      AUTH_CTFTIME_ID = "1260";
    };
    serviceConfig = {
      ExecStart = "${lib.getExe pkgs.vouchers}";
      EnvironmentFile = config.sops.secrets.vouchers-env.path;
      DynamicUser = true;
    };
  };

  services.nginx.virtualHosts."ctf-vouchers.de" = {
    forceSSL = true;
    enableACME = true;

    locations."/" = {
      proxyPass = "http://localhost:3000";
      proxyWebsockets = true;
      recommendedProxySettings = true;
    };
  };
}
