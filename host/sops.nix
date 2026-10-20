{ config, ... }:
{
  sops.age.sshKeyPaths = [ "/etc/ssh/ssh_host_ed25519_key" ];
  sops.defaultSopsFile = ./secrets.yaml;
  sops.secrets = {
    vouchers-env = { };
    # htpasswd lines for /admin, e.g. from `htpasswd -nB <user>`
    admin-htpasswd = {
      owner = config.services.nginx.user;
    };
    grafana_password = {
      owner = config.systemd.services.grafana.serviceConfig.User;
    };
  };
}
