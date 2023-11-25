
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { execSync } = require('child_process');

class GitSync {
  constructor({ 
      url, username, password, 
      repo, ref, period, 
      projectId, credentialSecret, 
      dataPath, backupPath, rootPath, 
      ...options 
  }) {
    this.url = url || 'http://localhost:1880';
    this.username = username;
    this.password = password;
    this.repo = repo;
    this.ref = ref || 'HEAD';
    this.projectId = projectId || repo.split('/').pop().replace(/\.git$/, '');
    this.credentialSecret = credentialSecret;
    this.period = +(period || 120);
    
    this.dataPath = dataPath || '/data';
    this.backupPath = backupPath || '/backup';
    this.rootPath = rootPath || path.resolve(`${this.dataPath}/projects/${this.projectId}`);

    this.opts = options;
    this.intervalId = null;
  }

  _backupAndDelete(source, destination) {
    console.log('# ------------------------- backing up existing files ------------------------ #');
    const backupPath = path.join(destination, new Date().toISOString().replace(/[^0-9]/g, ''));
    console.log(`Backup destination: ${backupPath}`);
    fs.mkdirSync(backupPath, { recursive: true });
    fs.copyFileSync(source, path.join(backupPath, path.basename(source)));
    fs.rmdirSync(source, { recursive: true });
    console.log('\nGit destination is now clean:');
    console.log(fs.readdirSync(destination));
  }

  _checkGitRemote() {
    // Check if the directory exists and is not empty
    if (fs.existsSync(this.rootPath) && fs.readdirSync(this.rootPath).length > 0) {
      console.log('# ---------------------------------------------------------------------------- #');
      console.log(`Git Destination "${this.rootPath}" already exists:`);
      console.log(fs.readdirSync(this.rootPath));

      const remoteUrl = execSync(`git -C "${this.rootPath}" remote get-url origin`).toString().trim();
      console.log(`Detected Remote URL: ${remoteUrl}`);
      console.log(`Desired Remote URL: ${this.repo}`);

      if (remoteUrl === this.repo) {
        console.log('Looks good!');
      } else {
        this._backupAndDelete(this.rootPath, this.backupPath);
      }
    }
  }

  _clone() {
    console.log('# ---------------------------------- Cloning --------------------------------- #');
    console.log(`Cloning ${this.repo} to ${this.rootPath}`);
    fs.mkdirSync(this.rootPath, { recursive: true });
    execSync(`git clone --branch ${this.ref} ${this.repo} ${this.rootPath}`);
    console.log(fs.readdirSync(this.rootPath));
    console.log('# ---------------------------------------------------------------------------- #');
  }

  _writeProjectsConfig() {
    const projectsFile = `${this.dataPath}/.config.projects.json`;
    console.log('# --- Writing .config.projects.json --');
  
    // Update projects in the configuration file
    const proj = fs.existsSync(projectsFile) ? fs.readFileSync(projectsFile) : {};
    const data = JSON.stringify({
        projects: {
            ...proj.projects,
            [this.projectId]: { credentialSecret: this.credentialSecret }
        },
        activeProject: this.projectId,
    }, null, 2)
    fs.writeFileSync(projectsFile, data);
    fs.writeFileSync(`${projectsFile}.backup`, data);
  }

  async _installPackages(Authorization) {
    
}

  clone() {
    try {
      this._writeProjectsConfig();
      this._checkGitRemote();

      // Clone the git repository if it doesn't exist
      if (!fs.existsSync(path.join(this.rootPath, '.git'))) {
        this._clone();
      }
      this.runHook();
    } catch (error) {
      console.error(`Error cloning repository: ${error}`);
    }
  }


  checkChanges() {
      try {
          // go to correct directory
          console.log(`# --- Checking at ${new Date()}`);
      
          // Check for local changes
          const statusOutput = execSync(`git -C "${this.rootPath}" status -uno --porcelain`).toString().trim();
          if (statusOutput) {
            console.log('We have local uncommitted changes!');
            console.log('Please commit your changes before we can pull.');
          } else {
            // Perform git pull if there are changes
            execSync(`git -C "${this.rootPath}" fetch origin`);
            const pullDryRunOutput = execSync(`git -C "${this.rootPath}" rev-list HEAD..origin/${this.ref}`).toString().trim();
            if (pullDryRunOutput && execSync(`git -C "${this.rootPath}" pull --dry-run --rebase`).toString().trim()) {
              console.log(`Pulling from ${this.rootPath}`);
              if (execSync(`git -C "${this.rootPath}" pull --rebase`).toString().trim()) {
                this.runHook();
              }
            } else {
              console.log('No changes to pull');
            }
          }
      } catch (error) {
          console.error(`Error pulling from git: ${error}`)
      }
  }


  runHook() {
    if(!this.password){
      console.error('# --- No nodered password for flow update --');
      return;
    }
    runOnceNodeRedReady(this.url, () => {
      runHook({
        url: this.url,
        rootPath: this.rootPath,
        username: this.username,
        password: this.password,
        projectId: this.projectId, 
        credentialSecret: this.credentialSecret, 
      })
    }, 5000);
  }

  startSync() {
    // Check if the setInterval is already started
    if (!this.intervalId) {
      this.clone();
      this.intervalId = setInterval(() => {
        console.log(`Checking for changes every ${this.period} seconds...`);
        this.checkChanges();
      }, this.period * 1000);
      console.log(`Git synchronization started. Checking for changes every ${this.period} seconds.`);
    }
  }

  stopSync() {
    // Clear the setInterval
    clearInterval(this.intervalId);
    this.intervalId = null;
    console.log('Git synchronization stopped.');
  }
}



const login = async ({ url, username, password }) => {
  console.log(`# --- Getting token... --`);
  try {
    const response = await axios.post(`${url}/auth/token`, {
      client_id: 'node-red-admin',
      grant_type: 'password',
      scope: '*',
      username,
      password,
    });

    const access_token = response.data.access_token;
    if (!access_token) {
      console.error('Error: Failed to obtain an access token.');
      return null;
    }

    const Authorization = `Bearer ${access_token}`;
    console.log('Got token!', Authorization);
    return Authorization;
  } catch (error) {
    console.error('Error during login:', error.message);
    return null;
  }
};

const setActiveProject = async (Authorization, { url, projectId, credentialSecret, user, email }) => {
  // https://github.com/node-red/node-red/blob/a55554193bac2ee4997948c6a15dd752844cace4/packages/node_modules/%40node-red/editor-api/lib/editor/projects.js#L117
  console.log(`# --- Setting the active project to ${projectId}... --`);
  try {
    const projectResponse = await axios.put(
      `${url}/projects/${projectId}`,
      { 
        active: true, 
        credentialSecret, 
        git: {
          user: user || 'nodered',
          email: email || 'nodered',
        },
        clearContext: false 
      },
      {
        headers: {
          Authorization,
          'content-type': 'application/json; charset=utf-8',
          'Node-RED-API-Version': 'v2',
        },
      }
    );

    console.error(projectResponse.data);

    if (projectResponse.status !== 200) {
      console.error('Error: Failed to set active project.');
    }
  } catch (error) {
    console.error('Error during setActiveProject:', error.message);
  }
};

const reloadFlows = async (Authorization, { url }) => {
  console.log('# --- Reloading flows... --');
  try {
    const reloadResponse = await axios.post(
      `${url}/flows`,
      { flows: [{ type: 'tab' }] },
      {
        headers: {
          Authorization,
          'Content-type': 'application/json',
          'Node-RED-Deployment-Type': 'reload',
          'Node-RED-API-Version': 'v2',
        },
      }
    );

    console.error(reloadResponse.data);

    if (reloadResponse.status !== 200) {
      console.error('Error: Failed to reload flows.');
    }
  } catch (error) {
    console.error('Error during reloadFlows:', error.message);
  }
};

const revoke = async (Authorization, { url }) => {
  console.log('# --- Revoking token... --');
  try {
    await axios.post(`${url}/auth/revoke`, null, {headers: { Authorization }});
  } catch (error) {
    console.error('Error during revoke:', error.message);
  }
};

const installPackages = async (Authorization, { url, rootPath }) => {
  // Install modules
  try {
      const nodesResponse = await axios.get(`${url}/nodes`, { headers: { Authorization, Accept: 'application/json' } });
      const nodes = nodesResponse.data;
      const dependencies = Object.keys(require(`${rootPath}/package.json`).dependencies || {});
  
      for (const dep of dependencies) {
          const installed = nodes.find((node) => node.module === dep);
          if (installed || !dep) {
              console.log(`# --- ${dep} is already installed. --`);
              continue;
          }
          console.log(`# --- Installing ${dep}... --`);
  
          try {
              const installResponse = await axios.post(
                  `${url}/nodes`,
                  { module: dep },
                  { headers: {
                      Authorization,
                      'content-type': 'application/json; charset=utf-8',
                      'Node-RED-API-Version': 'v2'
                  }});
          } catch (err) {
              console.error(`Failed installing ${dep}`);
          }
      }
  } catch (e) {
      console.error(`Error installing modules: ${e}`)
      return
  }
}

const runHook = async ({ projectId, credentialSecret, ...opts }) => {
  console.log('# ---------------------------- Running Update Hook --------------------------- #');
  console.log('# --- Reloading NodeRed... --');
  try {
    const Authorization = await login(opts);
    if (Authorization) {
      try {
          projectId && await setActiveProject(Authorization, opts);
          await installPackages(Authorization, opts);  
          await reloadFlows(Authorization, opts);
          console.log('Finished update.');
      } catch (e) {
        console.log(`Failed reload. ${e.message}`);
      } finally {
          await revoke(Authorization, opts);
      }
    } else {
      console.log('Failed to obtain token. Update aborted.');
    }
  } catch (error) {
    console.log('Failed update.');
    console.error(error.message);
    // setTimeout(runHook, 5000);
  }
  console.log('# ---------------------------------------------------------------------------- #');
};



const checkNodeRedStatus = async (url) => {
  try {
    const response = await axios.get(url);
    return response.status === 200;
  } catch (error) {
    console.error('Error checking Node-RED status:', error.message);
    return false;
  }
};

const runOnceNodeRedReady = (url, func, interval) => {
  const id = setInterval(async () => {    
      if (await checkNodeRedStatus(url)) {
        // console.log('Node-RED is up.');
        clearInterval(id);
        func();
      } else {
        console.log('Node-RED is not up. Retrying...');
      }
  }, interval);
};

module.exports = GitSync;