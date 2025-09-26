{
  config,
  lib,
  ...
}:
{
  services.grafana = {
    enable = true;

    settings = {
      users = {
        allow_sign_up = false;
        auto_assign_org = true;
        auto_assign_org_role = "Admin";
      };

      server = {
        http_addr = "127.0.0.1";
        http_port = 3001;
        domain = "grafana.ctf-vouchers.de";
        root_url = "%(protocol)s://%(domain)s/";
      };

      security = {
        disable_initial_admin_creation = false;
        admin_user = "admin";
        admin_password = "$__file{${config.sops.secrets.grafana_password.path}}";
      };
    };

    provision = {
      enable = true;
      datasources.settings.datasources = [
        {
          name = "vouchers";
          type = "postgres";
          editable = false;
          url = "/run/postgresql";
          user = "vouchers";
          database = "vouchers";
        }
        {
          name = "prometheus";
          type = "prometheus";
          editable = false;
          url = "http://localhost:${builtins.toString config.services.prometheus.port}";
        }
      ];
    };
  };

  services.nginx.virtualHosts."grafana.ctf-vouchers.de" = {
    forceSSL = true;
    enableACME = true;

    locations."/" = {
      proxyPass = "http://127.0.0.1:3001";
      proxyWebsockets = true;
      recommendedProxySettings = true;
    };
  };
}
