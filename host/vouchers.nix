{
  lib,
  config,
  pkgs,
  ...
}:
let
  # Secrets (AUTH_CTFTIME_SECRET, NEXTAUTH_SECRET, MAILGUN_API_KEY,
  # MAILGUN_SIGNING_KEY, SHUFFLE_SEED, SEED_SECRET, CRON_SECRET, ADMIN_EMAIL,
  # ADMIN_SENDER_ALLOWLIST) live in the vouchers-env sops secret.
  environment = {
    DATABASE_URL = "postgresql://vouchers@localhost/vouchers?host=/run/postgresql";
    NEXTAUTH_URL = "https://ctf-vouchers.de";
    AUTH_CTFTIME_ID = "1260";
    MAILGUN_DOMAIN = "ctf-vouchers.de";
    MAILGUN_API_BASE = "https://api.eu.mailgun.net";
    CCC_SENDER_ALLOWLIST = "@cccv.de";
    CONFIRM_HOURS = "6";
    OVERDUE_HOURS = "24";
    OVERDUE_HARD_HOURS = "96";
    HOME = "/var/cache/vouchers";
  };

  proxy = {
    proxyPass = "http://127.0.0.1:3000";
    proxyWebsockets = true;
    recommendedProxySettings = true;
  };

  admin = proxy // {
    basicAuthFile = config.sops.secrets.admin-htpasswd.path;
    extraConfig = ''
      proxy_set_header X-Admin-User $remote_user;
    '';
  };

  tick = pkgs.writeShellScript "vouchers-tick" ''
    printf 'header = "Authorization: Bearer %s"\n' "$CRON_SECRET" \
      | ${lib.getExe pkgs.curl} -fsS -X POST -K - http://127.0.0.1:3000/api/cron/tick
  '';
in
{
  systemd.services.vouchers = {
    wantedBy = [ "multi-user.target" ];
    after = [
      "network.target"
      "postgresql.service"
    ];
    requires = [ "postgresql.service" ];
    inherit environment;
    serviceConfig = {
      ExecStartPre = "${pkgs.vouchers}/bin/prisma migrate deploy";
      ExecStart = "${lib.getExe pkgs.vouchers}";
      EnvironmentFile = config.sops.secrets.vouchers-env.path;
      DynamicUser = true;
      CacheDirectory = "vouchers";
      Restart = "on-failure";
    };
  };

  # Sends the outbox, flags overdue vouchers, picks up released vouchers.
  systemd.services.vouchers-tick = {
    after = [ "vouchers.service" ];
    serviceConfig = {
      Type = "oneshot";
      ExecStart = tick;
      EnvironmentFile = config.sops.secrets.vouchers-env.path;
      DynamicUser = true;
    };
  };

  systemd.timers.vouchers-tick = {
    wantedBy = [ "timers.target" ];
    timerConfig = {
      OnCalendar = "minutely";
      AccuracySec = "5s";
    };
  };

  services.nginx.virtualHosts."ctf-vouchers.de" = {
    forceSSL = true;
    enableACME = true;

    locations = {
      # The app trusts X-Admin-User, so it must only come from basic auth.
      "/" = proxy // {
        extraConfig = ''
          proxy_set_header X-Admin-User "";
        '';
      };
      "/admin" = admin;
      "/api/admin/" = admin;
      # Only reachable from the tick timer on localhost.
      "/api/cron/".return = "404";
      # Mailgun forwards whole mails including attachments.
      "/api/mailgun/" = proxy // {
        extraConfig = ''
          proxy_set_header X-Admin-User "";
          client_max_body_size 30m;
        '';
      };
    };
  };
}
