{
  lib,
  stdenv,
  fetchYarnDeps,
  yarnConfigHook,
  yarnBuildHook,
  makeWrapper,
  nodejs,
  yarn,
  openssl,
  prisma-engines,
  ...
}:

stdenv.mkDerivation (finalAttrs: rec {
  pname = "web";
  version = "0.0.1";

  src = ./web;

  yarnOfflineCache = fetchYarnDeps {
    yarnLock = src + "/yarn.lock";
    hash = "sha256-GdGGGre7j4xSzHpmZibcGIXSTUQ47woe+Zeotw6FM08=";
  };

  nativeBuildInputs = [
    yarnConfigHook
    yarnBuildHook
    makeWrapper
    nodejs
  ];

  propagatedBuildInputs = [
    openssl
    prisma-engines
  ];

  installPhase = ''
    runHook preInstall

    mkdir -p $out/web
    cp -r . $out/web/

    ln -s ${lib.getExe' prisma-engines "schema-engine"} $out/web/node_modules/schema-engine-linux-nixos

    mkdir -p $out/bin
    makeWrapper ${lib.getExe yarn} $out/bin/web \
      --chdir $out/web \
      --set PRISMA_QUERY_ENGINE_LIBRARY $out/web/src/generated/prisma/libquery_engine.node \
      --append-flags start

    makeWrapper ${lib.getExe yarn} $out/bin/prisma \
      --chdir $out/web \
      --argv0 prisma \
      --set PRISMA_QUERY_ENGINE_LIBRARY $out/web/src/generated/prisma/libquery_engine.node \
      --add-flags 'run prisma'

    runHook postInstall
  '';

  meta = {
    mainProgram = "web";
  };
})
