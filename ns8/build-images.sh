#!/bin/bash
#
# Build the NethServer 8 rootless OCI module image for MDTeam Workspace
# using buildah (compatible with local NS8 developer builds and GitHub Actions).
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

REPobase="${REPobase:-ghcr.io/bls-isp}"
reponame="mdteam"
IMAGETAG="${IMAGETAG:-1.2.0}"

APP_TAG="${APP_TAG:-${IMAGETAG}}"
if [[ "${IMAGETAG}" == "latest" || "${APP_TAG}" == "latest" ]]; then
    echo "Error: Floating 'latest' image tags are forbidden in NethServer 8. Specify an explicit SemVer tag (e.g. 1.1.0)." >&2
    exit 1
fi
WORKSPACE_WEB_IMAGE="ghcr.io/bls-isp/mdteam/workspace-web:${APP_TAG}"
API_SERVER_IMAGE="ghcr.io/bls-isp/mdteam/api-server:${APP_TAG}"
YJS_SERVER_IMAGE="ghcr.io/bls-isp/mdteam/yjs-server:${APP_TAG}"

images=()

# 1. Build Cockpit Vue UI inside node:20-slim container
ui_container=$(buildah from docker.io/library/node:20-slim)
trap 'buildah rm -f "${ui_container}" "${module_container:-}" >/dev/null 2>&1 || true' EXIT

buildah run "${ui_container}" -- mkdir -p /usr/src/ui
buildah copy "${ui_container}" "${SCRIPT_DIR}/ui" /usr/src/ui
buildah run --workingdir=/usr/src/ui \
    --env NODE_OPTIONS=--openssl-legacy-provider \
    "${ui_container}" -- sh -c "npm install --legacy-peer-deps && npm run build"

# 2. Prepare imageroot in alpine:3.20 (strip __pycache__, CRLF, set +x)
prep_container=$(buildah from docker.io/library/alpine:3.20)
trap 'buildah rm -f "${ui_container}" "${prep_container}" "${module_container:-}" >/dev/null 2>&1 || true' EXIT

buildah copy "${prep_container}" "${SCRIPT_DIR}/imageroot" /imageroot
buildah run "${prep_container}" -- sh -c '
    find /imageroot -name "__pycache__" -type d -exec rm -rf {} + &&
    find /imageroot -name "*.pyc" -delete &&
    find /imageroot -type f -exec sed -i "s/\r$//" {} + &&
    chmod +x /imageroot/actions/*/[0-9]* \
             /imageroot/events/*/[0-9]* \
             /imageroot/update-module.d/* \
             /imageroot/bin/*
'

# 3. Assemble final scratch NS8 module image
module_container=$(buildah from scratch)
buildah copy --from="${prep_container}" "${module_container}" /imageroot /imageroot
buildah copy --from="${ui_container}" "${module_container}" /usr/src/ui/dist /ui

buildah config \
    --entrypoint='["/"]' \
    --label="org.opencontainers.image.source=https://github.com/BLS-ISP/MDTeam" \
    --label="org.nethserver.authorizations=traefik@node:routeadm cluster:accountconsumer" \
    --label="org.nethserver.tcp-ports-demand=1" \
    --label="org.nethserver.rootfull=0" \
    --label="org.nethserver.max-per-node=5" \
    --label="org.nethserver.min-core=3.0.0" \
    --label="org.nethserver.flags=" \
    --label="org.nethserver.images=${WORKSPACE_WEB_IMAGE} ${API_SERVER_IMAGE} ${YJS_SERVER_IMAGE}" \
    "${module_container}"

FULL_IMAGE="${REPobase}/${reponame}"
buildah commit "${module_container}" "${FULL_IMAGE}:${IMAGETAG}"
images+=("${FULL_IMAGE}:${IMAGETAG}")

if [[ -n "${CI:-}" && -n "${GITHUB_OUTPUT:-}" ]]; then
    printf "images=%s\n" "${images[*]}" >> "${GITHUB_OUTPUT}"
else
    printf "Built NS8 module image:\n"
    for img in "${images[@]}"; do
        printf "  %s\n" "${img}"
    done
fi

if [[ "${PUBLISH_IMAGE:-0}" == "1" ]]; then
    for img in "${images[@]}"; do
        buildah push "${img}" "docker://${img}"
    done
fi
