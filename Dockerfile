FROM registry.k8s.io/git-sync/git-sync:v4.0.0
COPY --from=ghcr.io/tarampampam/curl /bin/curl /bin/curl

ADD reload.sh /tmp
ENV GITSYNC_EXECHOOK_COMMAND=/tmp/reload.sh
