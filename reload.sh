#!/bin/sh

# Ensure required variables are set
if [ -z "${NODE_RED_URL}" ] || [ -z "${NODE_RED_USERNAME}" ] || [ -z "${NODE_RED_PASSWORD}" ]; then
    echo "Error: Please set NODE_RED_URL, NODE_RED_USERNAME, and NODE_RED_PASSWORD environment variables."
    exit 1
fi

# Log in and obtain an access token
echo "Getting token..."
response=$(curl -X POST "${NODE_RED_URL}/auth/token" \
        -d "client_id=node-red-admin&grant_type=password&scope=read&username=${NODE_RED_USERNAME}&password=${NODE_RED_PASSWORD}")

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
response=$(curl -X POST "${NODE_RED_URL}/flows" \
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
curl -X POST "${NODE_RED_URL}/auth/revoke" -H "${AUTH}"
