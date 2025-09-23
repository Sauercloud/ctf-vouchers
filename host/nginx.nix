_: {
  services.nginx.enable = true;

  security.acme = {
    acceptTerms = true;
    defaults.email = "mail@ctf-vouchers.de";
  };

  networking.firewall.allowedTCPPorts = [
    80
    443
  ];
}
