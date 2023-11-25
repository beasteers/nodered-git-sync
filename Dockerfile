FROM nodered/node-red:latest-18
RUN npm i @node-red-contrib-themes/theme-collection

USER root
COPY package.json /usr/src/node-red/git-sync/package.json
COPY src /usr/src/node-red/git-sync/src
RUN npm install /usr/src/node-red/git-sync
USER node-red