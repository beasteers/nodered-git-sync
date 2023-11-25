# @beasteers/nodered-projects-git-sync

This module provides automatic orchestration of Node-RED using its Git-backed project feature. It facilitates synchronization of Node-RED projects with a Git repository, ensuring seamless collaboration and version control for your Node-RED flows.

## Install

```bash
npm install @beasteers/nodered-projects-git-sync
```

## Usage
In `settings.js`:
```javascript
const GitSync = require('@beasteers/nodered-projects-git-sync');

const gitrepo = new GitSync({
  repo: process.env.GITSYNC_REPO,
  // ref: process.env.GITSYNC_REF || 'HEAD',
  // period: process.env.GITSYNC_PERIOD || 120,
  credentialSecret: process.env.NODERED_CREDENTIAL_SECRET,
  username: process.env.NODERED_USERNAME,
  password: process.env.NODERED_PASSWORD,
})

gitrepo.clone();
gitrepo.startSync();

module.exports = {
    flowFile: gitrepo.projectId,
    credentialSecret: gitrepo.credentialSecret,
    ...
}
```