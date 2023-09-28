FROM alpine

RUN apk add --no-cache git curl jq openssh

WORKDIR /scripts
ADD known_hosts /root/.ssh/
ADD config /root/.ssh/
ADD pull.sh /scripts
ADD update_nodered.sh /scripts


ENV GITSYNC_DEST=/git
ENV GITSYNC_REF main
ENV GITSYNC_PERIOD 300
# ENV GITSYNC_EXECHOOK_COMMAND update_nodered.sh
# RUN mkdir $GITSYNC_DEST && chmod 777 $GITSYNC_DEST

CMD ["pull.sh"]