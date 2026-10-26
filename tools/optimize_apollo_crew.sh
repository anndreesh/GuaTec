#!/usr/bin/env bash
# Reproduce the project-local derivative of Peter_D's CC BY 4.0 Mercenary Astronaut.
# Preserve this attribution and the asset's embedded source/license metadata.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p frontend/public/assets/apollo
npx --yes @gltf-transform/cli@4.5.1 optimize \
  frontend/public/assets/models/mercenary_astronaut.glb \
  frontend/public/assets/apollo/mercenary-astronaut.glb \
  --compress meshopt --texture-compress webp --texture-size 512 \
  --simplify-ratio 0.15 --simplify-error 0.002 \
  --flatten false --join false --palette false
