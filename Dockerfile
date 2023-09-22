FROM registry.k8s.io/git-sync/git-sync:v4.0.0
COPY --from=ghcr.io/tarampampam/curl /bin/curl /bin/curl

USER root
RUN mkdir /data && chown 65533:65533 /data
USER git-sync

ADD known_hosts /etc/git-secret/
ADD on_pull.sh /tmp

# ensure write permissions
ENV GITSYNC_ADD_USER=true
ENV GITSYNC_GROUP_WRITE=true
ENV GITSYNC_ROOT=/git/dest
ENV NODERED_ROOT=/data

# nodered callback script
ENV GITSYNC_EXECHOOK_COMMAND=/tmp/on_pull.sh