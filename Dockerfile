FROM alpine

RUN apk add --no-cache git curl jq openssh

ENV HOME /tmp
ENV CUID 65532
ENV CGID 65532

# # add default user
RUN addgroup --gid "$CGID" git-sync
# RUN echo "git-sync:x:$CUID:$CGID::$HOME:/sbin/nologin" >> /etc/passwd
RUN chmod 0666 /etc/passwd

# make folders widely readable
RUN mkdir -p -m 777 /scripts
RUN mkdir -p -m 777 /backup
RUN mkdir -p -m 777 /git
RUN mkdir -p -m 777 $HOME && chown $CUID:$CGID $HOME
# RUN mkdir -p -m 777 $HOME/.ssh

WORKDIR /scripts
USER $CUID:$CGID
# add the ssh config somewhere else
# we create a new one within the 
ADD config/ssh_known_hosts /etc/ssh/ssh_known_hosts
ADD config/ssh_config /etc/ssh/ssh_config

# global git ignore
ADD config/global.gitignore /etc/.gitignore
RUN git config --global core.excludesfile /etc/.gitignore
RUN git config --global --add safe.directory /git
RUN git config --global user.name "nodered-git-sync"
RUN git config --global user.email "nodered-git-sync@domain.com"
RUN chmod 0777 $HOME/.gitconfig

ADD scripts/pull.sh /scripts
ADD scripts/update_nodered.sh /scripts

# RUN mkdir -p -m 02775 "$HOME" && chown -R $CUID:$CGID "$HOME"
# RUN chmod 777 /scripts/.ssh/*

ENV GITSYNC_ROOT /git
ENV GITSYNC_REF main
ENV GITSYNC_PERIOD 300
ENV GITSYNC_EXECHOOK_COMMAND /scripts/update_nodered.sh

CMD ["/scripts/pull.sh"]