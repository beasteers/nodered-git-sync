#!/bin/sh

if [ -z "$GITSYNC_REPO" ]; then
echo "Please set GITSYNC_REPO=https://github.com/your-git-repository"
    exit 1
fi

GITSYNC_BACKUP_DIR="${GITSYNC_BACKUP_DIR:-/backup}"
GITSYNC_DEST=$(realpath "${GITSYNC_DEST:-/git}")

# check - does the directory exist and is not empty? if yes, backup the files and delete
# BUT!! if the git repo is from "$GITSYNC_REPO" then don't do anything
if [ -d "$GITSYNC_DEST" ]; then
    echo "$GITSYNC_DEST already exists"
    if [ -d "$GITSYNC_DEST/.git" ] && [ "$(git -C "$GITSYNC_DEST" config --get remote.origin.url)" = "$GITSYNC_REPO" ]; then
        echo "but it's cool because it's the right git remote url!"
    else
        bkp=$GITSYNC_BACKUP_DIR/$(date +"%Y%m%d-%H%M%S")
        echo "I'm not really sure what's up with the files so I'm going to move them to $bkp"
        cp -r "$GITSYNC_DEST" "$bkp" && find "$GITSYNC_DEST" -mindepth 1 -delete        
    fi
fi

while true; do

# 
if [ ! -d "$GITSYNC_DEST/.git" ]; then
    # clone the git repository
    echo "Cloning $GITSYNC_REPO to $GITSYNC_DEST"
    git clone  --branch $GITSYNC_REF --single-branch $GITSYNC_REPO $GITSYNC_DEST || exit 1
fi

cd $GITSYNC_DEST

# check if there are local changes. do nothing to avoid merge conflicts.
if git status -uno --porcelain | grep -q .; then
    echo "Branch has changes!"
else
    if [ -n "$(git fetch origin; git rev-list HEAD..FETCH_HEAD)" ]; then
        # git pull
        echo "Pulling from $GITSYNC_REPO"
        if git pull --rebase; then
            echo "Changes!"
            # run update script only when git pulls anything successfully
            [ ! -z $GITSYNC_EXECHOOK_COMMAND ] && $GITSYNC_EXECHOOK_COMMAND
        fi
    else
        echo "No changes to pull"
    fi
fi

# sleep for a specified interval (e.g., 1 hour)
echo "Sleeping for $GITSYNC_PERIOD seconds..."
sleep $GITSYNC_PERIOD

done