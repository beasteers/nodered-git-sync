#!/bin/sh

NODERED_URL="${NODERED_URL:-localhost:1880}"
NODERED_USERNAME="${NODERED_USERNAME:-admin}"

# Ensure required variables are set
if [ -z "${NODERED_URL}" ] || [ -z "${NODERED_USERNAME}" ] || [ -z "${NODERED_PASSWORD}" ]; then
    echo "Error: Please set NODERED_URL, NODERED_USERNAME, and NODERED_PASSWORD environment variables."
    exit 1
fi

# Log in and obtain an access token
echo "Getting token..."
response=$(curl -X POST "${NODERED_URL}/auth/token" \
        -d "client_id=node-red-admin&grant_type=password&scope=read&username=${NODERED_USERNAME}&password=${NODERED_PASSWORD}")

# Check if the response contains an access token
access_token=$(echo "${response}" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
if [ -z "${access_token}" ]; then
    echo "Error: Failed to obtain an access token."
    exit 1
fi

# Set up the Authorization header
AUTH="Authorization: Bearer ${access_token}"

# Make a POST request to reload flows
echo "Reloading flows..."
response=$(curl -X POST "${NODERED_URL}/flows" \
        -d '{"flows": [{"type": "tab"}]}' \
        -H "${AUTH}" \
        -H 'content-type: application/json; charset=utf-8' \
        -H 'Node-RED-Deployment-Type: reload' \
        -H 'Node-RED-API-Version: v2')
echo $response

# Check the response for errors
if [ $? -ne 0 ]; then
    echo "Error: Failed to reload flows."
    exit 1
fi

# Make a POST request to revoke the token
echo "Revoking token..."
curl -X POST "${NODERED_URL}/auth/revoke" -H "${AUTH}"
