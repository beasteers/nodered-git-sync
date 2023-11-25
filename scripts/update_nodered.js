const axios = require('axios');
const fs = require('fs');
const execSync = require('child_process').execSync;

const DATA_PATH = '/data'

const NODERED_URL = process.env.NODERED_URL || 'http://localhost:1880';
const NODERED_USERNAME = process.env.NODERED_USERNAME || 'admin';
const NODERED_PASSWORD = process.env.NODERED_PASSWORD;
const NODERED_PROJECT_ID = process.env.NODERED_PROJECT_ID;
const NODERED_CREDENTIAL_SECRET = process.env.NODERED_CREDENTIAL_SECRET;


const login = async () => {
    console.error('Getting token...');
    const response = await axios.post(`${NODERED_URL}/auth/token`, {
      client_id: 'node-red-admin',
      grant_type: 'password',
      scope: 'read',
      username: NODERED_USERNAME,
      password: NODERED_PASSWORD
    });

    const access_token = response.data.access_token;
    if (!access_token) {
      console.error('Error: Failed to obtain an access token.');
      return;
    }
    const Authorization = `Bearer ${access_token}`;
    return Authorization;
}

const setActiveProject = async (Authorization) => {
    console.error(`Setting the active project to ${NODERED_PROJECT_ID}...`);
    const projectResponse = await axios.put(
        `${NODERED_URL}/projects/${NODERED_PROJECT_ID}`,
        { active: true, clearContext: false },
        { headers: {
            Authorization,
            'content-type': 'application/json; charset=utf-8',
            'Node-RED-API-Version': 'v2',
        } });
    console.error(projectResponse.data);
    if (projectResponse.status !== 200) {
        console.error('Error: Failed to set active project.');
    }
}

const reloadFlows = async (Authorization) => {
    console.error('Reloading flows...');
    const reloadResponse = await axios.post(
      `${NODERED_URL}/flows`,
      { flows: [{ type: 'tab' }] },
      { headers: { 
        Authorization,
        'content-type': 'application/json; charset=utf-8',
        'Node-RED-API-Version': 'v2',
        'Node-RED-Deployment-Type': 'reload' 
    } });
    console.error(reloadResponse.data);
}

const revoke = async (Authorization) => {
    console.error('Revoking token...');
    await axios.post(`${NODERED_URL}/auth/revoke`, null, { headers: { Authorization } });
}


const writeProjectsConfig = (activeProject, credentialSecret) => {
    const PROJECTS_FILE = `${DATA_PATH}/.config.projects.json`;

    // Update projects in the configuration file
    const proj = fs.existsSync(PROJECTS_FILE) ? fs.readFileSync(PROJECTS_FILE) : {};
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify({
        projects: {
            ...proj.projects,
            [activeProject]: { credentialSecret }
        },
        activeProject
    }, null, 2));
}

const installPackages = (activeProject) => {
    // Install packages with --prefix option to specify the installation directory
    const projectPath = `${DATA_PATH}/projects/${activeProject}`;
    child = exec(`cd "${projectPath}" && npm install --prefix "${DATA_PATH}"`, { stdio: 'inherit' });
}


const authenticateAndReloadFlows = async () => {
  try {
    if (NODERED_PROJECT_ID) {
        writeProjectsConfig(NODERED_PROJECT_ID, NODERED_CREDENTIAL_SECRET)
        installPackages(NODERED_PROJECT_ID);
    }

    const Authorization = await login();

    // if (NODERED_PROJECT_ID) {
    //     await setActiveProject(Authorization);
    // }

    await reloadFlows(Authorization);

    await revoke(Authorization);
  } catch (error) {
    console.error(error.message);
  }
};

module.exports = authenticateAndReloadFlows;