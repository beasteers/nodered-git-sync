const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const axios = require('axios');

// Git config
const GITSYNC_REPO = process.env.GITSYNC_REPO;
const GITSYNC_BACKUP_DIR = process.env.GITSYNC_BACKUP_DIR || '/backup';
const GITSYNC_REF = process.env.GITSYNC_REF || 'HEAD';  // XXX: is this the right default?
const GITSYNC_PERIOD = +(process.env.GITSYNC_PERIOD || 120);

const DATA_PATH = process.env.NODERED_DATA_PATH || '/data';
const PROJECT_ID = process.env.NODERED_PROJECT_ID || GITSYNC_REPO.split('/').pop().replace(/\.git$/, '');
const IS_ACTIVE = process.env.NODERED_PROJECT_ACTIVE;
const GITSYNC_ROOT = path.resolve(`${DATA_PATH}/projects/${PROJECT_ID}`);

const NODERED_URL = process.env.NODERED_URL || 'http://localhost:1880';
const NODERED_USERNAME = process.env.NODERED_USERNAME || 'admin';
const NODERED_PASSWORD = process.env.NODERED_PASSWORD;
const NODERED_CREDENTIAL_SECRET = process.env.NODERED_CREDENTIAL_SECRET;

console.log('# ---------------------------------- config ---------------------------------- #');
console.log(`Git Remote URL: ${GITSYNC_REPO} ${GITSYNC_REF}`);
console.log(`Git Destination Folder: ${GITSYNC_ROOT}`);
console.log(`NodeRed Project ID: ${PROJECT_ID} ${IS_ACTIVE ? '(active)' : ''}`);
console.log(`NodeRed URL: ${NODERED_USERNAME}@${NODERED_URL}`);
console.log(`Pull period (seconds): ${GITSYNC_PERIOD}`);

const createUser = () => {
    try {
        execSync('id -un || echo "git-sync:x:$(id -u):$CGID::$HOME:/sbin/nologin\n" >> /etc/passwd');
        console.log(execSync('id').toString());
    } catch (error) {
        console.error(error.message);
    }
}

const backupAndDelete = (source, destination) => {
  const backupPath = `${destination}/${new Date().toISOString().replace(/[^0-9]/g, '')}`;
  console.log(`Backup destination: ${backupPath}`);
  fs.mkdirSync(backupPath, { recursive: true });
  fs.copyFileSync(source, backupPath);
  fs.rmdirSync(source, { recursive: true });
  console.log('\nGit destination is now clean:');
  console.log(fs.readdirSync(destination));
};

const checkExistingRepo = () => {
    // Check if the directory exists and is not empty
    if (fs.existsSync(GITSYNC_ROOT) && fs.readdirSync(GITSYNC_ROOT).length > 0) {
      console.log('# ---------------------------------------------------------------------------- #');
      console.log(`Git Destination "${GITSYNC_ROOT}" already exists:`);
      console.log(fs.readdirSync(GITSYNC_ROOT));
    
      const remoteUrl = execSync(`git -C "${GITSYNC_ROOT}" remote get-url origin`).toString().trim();
      console.log('---');
      console.log(`Detected Remote URL: ${remoteUrl}`);
      console.log(`Desired Remote URL: ${GITSYNC_REPO}`);
      
      if (remoteUrl === GITSYNC_REPO) {
        console.log('Looks good!');
      } else {
        console.log('# ------------------------- backing up existing files ------------------------ #');
        backupAndDelete(GITSYNC_ROOT, GITSYNC_BACKUP_DIR);
      }
    }
}

const cloneRepo = () => {
    checkExistingRepo();

    // Clone the git repository if it doesn't exist
    if (!fs.existsSync(`${GITSYNC_ROOT}/.git`)) {
        console.log('# ---------------------------------- Cloning --------------------------------- #');
        console.log(`Cloning ${GITSYNC_REPO} to ${GITSYNC_ROOT}`);
        fs.mkdirSync(GITSYNC_ROOT, { recursive: true });
        try {
          execSync(`git clone --branch ${GITSYNC_REF} ${GITSYNC_REPO} ${GITSYNC_ROOT}`);
          console.log(fs.readdirSync(GITSYNC_ROOT));
        //   runHook();
          runOnceNodeRedReady(runHook, 3 * 1000);
          console.log('# ---------------------------------------------------------------------------- #');
        } catch (error) {
          console.error('Clone failed');
          // Handle the error if needed
        }
    } else {
        console.log('# ------------------------ Running Init Update Hook -------------------------- #');
        runHook();
        console.log('# ---------------------------------------------------------------------------- #');
    }
}

const checkChanges = async () => {
    try {
        // go to correct directory
        process.chdir(GITSYNC_ROOT);
        console.log(`# --- Checking at ${new Date()}`);
    
        // Check for local changes
        const statusOutput = execSync('git status -uno --porcelain').toString().trim();
        if (statusOutput) {
          console.log('We have local uncommitted changes!');
          console.log('Please commit your changes before we can pull.');
        } else {
          // Perform git pull if there are changes
          execSync('git fetch origin');
          const pullDryRunOutput = execSync(`git rev-list HEAD..origin/${GITSYNC_REF}`).toString().trim();
          if (pullDryRunOutput && execSync('git pull --dry-run --rebase').toString().trim()) {
            console.log(`Pulling from ${GITSYNC_REPO}`);
            if (execSync('git pull --rebase').toString().trim()) {
              await runHook();
            }
          } else {
            console.log('No changes to pull');
          }
        }
    } catch (error) {
        console.error(`Error pulling from git: ${error}`)
    }
}





const login = async () => {
    console.log(`# --- Getting token... --`);
    try {
      const response = await axios.post(`${NODERED_URL}/auth/token`, {
        client_id: 'node-red-admin',
        grant_type: 'password',
        scope: '*',
        username: NODERED_USERNAME,
        password: NODERED_PASSWORD,
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

  const setActiveProject = async (Authorization) => {
    // https://github.com/node-red/node-red/blob/a55554193bac2ee4997948c6a15dd752844cace4/packages/node_modules/%40node-red/editor-api/lib/editor/projects.js#L117
    console.log(`# --- Setting the active project to ${PROJECT_ID}... --`);
    try {
      const projectResponse = await axios.put(
        `${NODERED_URL}/projects/${PROJECT_ID}`,
        { active: true, credentialSecret: NODERED_CREDENTIAL_SECRET, clearContext: false },
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

const reloadFlows = async (Authorization) => {
    console.log('# --- Reloading flows... --');
    try {
      const reloadResponse = await axios.post(
        `${NODERED_URL}/flows`,
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

const revoke = async (Authorization) => {
    console.log('# --- Revoking token... --');
    try {
      await axios.post(`${NODERED_URL}/auth/revoke`, null, {
        headers: { Authorization },
      });
    } catch (error) {
      console.error('Error during revoke:', error.message);
    }
};


const writeProjectsConfig = (projectId, credentialSecret) => {
    const PROJECTS_FILE = `${DATA_PATH}/.config.projects.json`;
    console.log('# --- Writing .config.projects.json --');

    // Update projects in the configuration file
    const proj = fs.existsSync(PROJECTS_FILE) ? fs.readFileSync(PROJECTS_FILE) : {};
    const data = JSON.stringify({
        projects: {
            ...proj.projects,
            [projectId]: { credentialSecret }
        },
        activeProject: IS_ACTIVE ? projectId : proj.activeProject || projectId
    }, null, 2)
    fs.writeFileSync(PROJECTS_FILE, data);
    fs.writeFileSync(`${PROJECTS_FILE}.backup`, data);
}

// const installPackages = () => {
//     console.log(`# --- Installing Packages -- ${GITSYNC_ROOT}`);
//     child = execSync(`cd "${GITSYNC_ROOT}" && npm install --prefix "${DATA_PATH}"`, { stdio: 'inherit' });
// }

const installPackages = async (Authorization) => {
    // Install modules
    try {
        const nodesResponse = await axios.get(`${NODERED_URL}/nodes`, { headers: { Authorization, Accept: 'application/json' } });
        const nodes = nodesResponse.data;
        const dependencies = Object.keys(require(`${GITSYNC_ROOT}/package.json`).dependencies || {});
    
        for (const dep of dependencies) {
            const installed = nodes.find((node) => node.module === dep);
            if (installed) {
                console.log(`# --- ${dep} is already installed. --`);
                continue;
            }
            console.log(`# --- Installing ${dep}... --`);
    
            try {
                const installResponse = await axios.post(
                    `${NODERED_URL}/nodes`,
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

const runHook = async () => {
    console.log('# ---------------------------- Running Update Hook --------------------------- #');
    console.log('# --- Reloading NodeRed... --');
    try {
      writeProjectsConfig(PROJECT_ID, NODERED_CREDENTIAL_SECRET);
  
      const Authorization = await login();
      if (Authorization) {
        try {
            PROJECT_ID && await setActiveProject(Authorization);
            // writeProjectsConfig(PROJECT_ID, NODERED_CREDENTIAL_SECRET);
            await installPackages(Authorization);  
            await reloadFlows(Authorization);
            console.log('Finished update.');
        } catch (e) {
          console.log(`Failed reload. ${e.message}`);
        } finally {
            await revoke(Authorization);
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





const checkNodeRedStatus = async () => {
    try {
      const response = await axios.get(NODERED_URL);
      return response.status === 200;
    } catch (error) {
      console.error('Error checking Node-RED status:', error.message);
      return false;
    }
};

const runOnceNodeRedReady = (func, interval) => {
    const id = setInterval(async () => {
        const nodeRedIsAccessible = await checkNodeRedStatus();
      
        if (nodeRedIsAccessible) {
          console.log('Node-RED is up.');
          clearInterval(id);
          func();
        } else {
          console.log('Node-RED is not up. Retrying...');
        }
    }, interval);
};



// Execute the checkAndSyncGit function at regular intervals
createUser();
cloneRepo();
runOnceNodeRedReady(() => {
    setInterval(checkChanges, GITSYNC_PERIOD * 1000);
}, 3 * 1000);
