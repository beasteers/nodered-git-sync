#!/bin/sh
echo2() { echo "$@" 1>&2; }

# cd "$GITSYNC_ROOT"
# npm install -y

# ---------------------------------------------------------------------------- #
#                                     Login                                    #
# ---------------------------------------------------------------------------- #

NODERED_URL="${NODERED_URL:-localhost:1880}"
NODERED_USERNAME="${NODERED_USERNAME:-admin}"

# Ensure required variables are set
if [ -z "${NODERED_URL}" ]; then
    echo2 "Error: Please set NODERED_URL, NODERED_USERNAME, and NODERED_PASSWORD environment variables."
    exit 1
fi

if [ ! -z "${NODERED_USERNAME}" ] && [ ! -z "${NODERED_PASSWORD}" ]; then
    # Log in and obtain an access token
    echo2 "Getting token..."
    response=$(curl -X POST "${NODERED_URL}/auth/token" \
            -d "client_id=node-red-admin&grant_type=password&scope=read&username=${NODERED_USERNAME}&password=${NODERED_PASSWORD}")

    # Check if the response contains an access token
    access_token=$(echo "${response}" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
    if [ -z "${access_token}" ]; then
        echo2 "Error: Failed to obtain an access token."
        exit 1
    fi
fi

# Set up the Authorization header
AUTH="Authorization: Bearer ${access_token}"

# ---------------------------------------------------------------------------- #
#                                  Access API                                  #
# ---------------------------------------------------------------------------- #

if [ ! -z "$NODERED_PROJECT_ID" ]; then
    # Make a POST request to reload flows
    echo2 "Setting the active project to $NODERED_PROJECT_ID..."
    response=$(curl -X PUT "${NODERED_URL}/projects/$NODERED_PROJECT_ID" \
            -d '{"active": true, "clearContext": false}' \
            -H "${AUTH}" \
            -H 'content-type: application/json; charset=utf-8' \
            -H 'Node-RED-API-Version: v2')
    echo2 $response

    # Check the response for errors
    if [ $? -ne 0 ]; then
        echo2 "Error: Failed to set active project."
    fi
fi

# Make a POST request to reload flows
echo2 "Reloading flows..."
response=$(curl -o - -v -X POST "${NODERED_URL}/flows" \
        -d '{"flows": [{"type": "tab"}]}' \
        -H "${AUTH}" \
        -H 'content-type: application/json; charset=utf-8' \
        -H 'Node-RED-Deployment-Type: reload' \
        -H 'Node-RED-API-Version: v2')
echo2 $response

# install modules
nodes=$(curl -s "${NODERED_URL}/nodes" -H "${AUTH}" -H "Accept: application/json")
deps="$(cat "$GITSYNC_ROOT/package.json" | jq -r '.dependencies | keys_unsorted[]')"

echo "$deps" | while IFS= read -r dep ; do
    installed=$(echo $nodes | jq -r '.[] | select(.module == "'"$dep"'")')

    if [ -n "$installed" ]; then
        echo2 "$dep is already installed."
        continue
    fi

    # Make a POST request to reload flows
    echo2 "Installing $dep..."
    response=$(curl -X POST "${NODERED_URL}/nodes" \
            -d '{"module": "'"$dep"'"}' \
            -H "${AUTH}" \
            -H 'content-type: application/json; charset=utf-8' \
            -H 'Node-RED-API-Version: v2')
    echo2 $response
    # Check the response for errors
    if [ $? -ne 0 ]; then
        echo2 "Error: Failed to reload flows."
    fi
done


# ---------------------------------------------------------------------------- #
#                                 Revoke Token                                 #
# ---------------------------------------------------------------------------- #


# Make a POST request to revoke the token
if [ ! -z "$access_token" ]; then
    echo2 "Revoking token..."
    curl -X POST "${NODERED_URL}/auth/revoke" -H "${AUTH}"
fi
