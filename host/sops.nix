{ config, ... }:
{
  sops.age.sshKeyPaths = [ "/etc/ssh/ssh_host_ed25519_key" ];
  sops.defaultSopsFile = ./secrets.yaml;
  sops.secrets = {
    vouchers-env = { };
    grafana_password = {
      owner = config.systemd.services.grafana.serviceConfig.User;
    };
  };
}
