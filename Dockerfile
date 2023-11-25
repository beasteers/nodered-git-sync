FROM nodered/node-red:latest-18
RUN npm i @node-red-contrib-themes/theme-collection axios
ADD scripts/git_module.js /data
# FROM node:21-alpine
# # alpine

# WORKDIR /src

# RUN apk add --no-cache git curl jq openssh
# RUN npm install axios

# ENV HOME /tmp
# ENV CUID 1000
# ENV CGID 1000
# # 65532

# # # add default user
# # RUN addgroup --gid "$CGID" git-sync
# # RUN echo "git-sync:x:$CUID:$CGID::$HOME:/sbin/nologin" >> /etc/passwd
# RUN chmod 0666 /etc/passwd

# # make folders widely readable
# RUN mkdir -p -m 777 /scripts
# RUN mkdir -p -m 777 /backup
# RUN mkdir -p -m 777 /git
# RUN mkdir -p -m 777 $HOME && chown $CUID:$CGID $HOME
# # RUN mkdir -p -m 777 $HOME/.ssh

# USER $CUID:$CGID
# # add the ssh config somewhere else
# # we create a new one within the 
# ADD config/ssh_known_hosts /etc/ssh/ssh_known_hosts
# ADD config/ssh_config /etc/ssh/ssh_config

# # global git ignore
# ADD config/global.gitignore /etc/.gitignore
# RUN git config --global core.excludesfile /etc/.gitignore
# RUN git config --global --add safe.directory /git
# RUN git config --global user.name "nodered-git-sync"
# RUN git config --global user.email "nodered-git-sync@domain.com"
# RUN chmod 0777 $HOME/.gitconfig

# ADD scripts/*.js /src
# ADD scripts/*.sh /src

# # RUN mkdir -p -m 02775 "$HOME" && chown -R $CUID:$CGID "$HOME"
# # RUN chmod 777 /scripts/.ssh/*

# ENV GITSYNC_ROOT /git
# ENV GITSYNC_REF main
# ENV GITSYNC_PERIOD 300
# # ENV GITSYNC_EXECHOOK_COMMAND /scripts/update_nodered.sh

# CMD ["node", "/src/pull.js"]