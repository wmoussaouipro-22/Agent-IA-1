#!/usr/bin/env bash
# Vérifie que l'application s'installe et fonctionne dans un environnement vierge :
# 1. installation du paquet dans un venv neuf (sans le code source dans le chemin Python),
# 2. chargement de chaque module de app/,
# 3. parcours de bout en bout (pytest -m e2e) sur le paquet installé.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

if ! compgen -G "$ROOT/app/*/__init__.py" > /dev/null; then
  echo "::error::Aucun module dans app/ : rien à installer (l'application n'est pas encore écrite)."
  exit 1
fi

echo "== 1/3 Installation dans un environnement vierge"
python -m venv "$WORK/venv"
"$WORK/venv/bin/pip" install --quiet "$ROOT" -r "$ROOT/requirements-dev.txt"

echo "== 2/3 Chargement des modules installés"
modules=$(for d in "$ROOT"/app/*/__init__.py; do basename "$(dirname "$d")"; done)
(cd "$WORK" && for m in $modules; do
  "$WORK/venv/bin/python" -I -c "import $m; print('  ok', '$m', '->', $m.__file__)"
done)

echo "== 3/3 Parcours de bout en bout sur le paquet installé"
cp -r "$ROOT/tests" "$ROOT/pyproject.toml" "$ROOT/.gitignore" "$WORK/"
(cd "$WORK" && "$WORK/venv/bin/python" -m pytest -m e2e -p no:cacheprovider -o pythonpath=)

echo "Déploiement vérifié : installation, modules et parcours e2e OK."
