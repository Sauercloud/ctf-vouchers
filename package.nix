{
  lib,
  stdenv,
  fetchYarnDeps,
  yarnConfigHook,
  yarnBuildHook,
  makeWrapper,
  nodejs,
  yarn,
  prisma-engines,
  ...
}:

stdenv.mkDerivation (finalAttrs: rec {
  pname = "web";
  version = "0.2.0";

  src = ./web;

  yarnOfflineCache = fetchYarnDeps {
    yarnLock = src + "/yarn.lock";
    hash = "sha256-XvH/CNCCKI0bx+NGmce5KukdalwIGcaz+Oi1rc/culY=";
  };

  nativeBuildInputs = [
    yarnConfigHook
    yarnBuildHook
    makeWrapper
    nodejs
  ];

  env = {
    NEXT_TELEMETRY_DISABLED = "1";
    PRISMA_SCHEMA_ENGINE_BINARY = lib.getExe' prisma-engines "schema-engine";
    PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING = "1";
  };

  installPhase = ''
    runHook preInstall

    mkdir -p $out/web
    cp -r . $out/web/

    # Prisma 7 uses the pg driver adapter at runtime; only migrations need a
    # native engine, which has to match the prisma version from yarn.lock.
    mkdir -p $out/bin
    makeWrapper ${lib.getExe yarn} $out/bin/web \
      --chdir $out/web \
      --set NEXT_TELEMETRY_DISABLED 1 \
      --append-flags start

    makeWrapper ${lib.getExe yarn} $out/bin/prisma \
      --chdir $out/web \
      --argv0 prisma \
      --set PRISMA_SCHEMA_ENGINE_BINARY ${lib.getExe' prisma-engines "schema-engine"} \
      --add-flags '-s prisma'

    runHook postInstall
  '';

  meta = {
    mainProgram = "web";
  };
})
