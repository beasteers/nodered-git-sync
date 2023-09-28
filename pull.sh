#!/usr/bin/env sh

if [ -z "$GITSYNC_REPO" ]; then
echo "Please set GITSYNC_REPO=https://github.com/your-git-repository"
    exit 1
fi

while true; do

if [ ! -d "$GITSYNC_DEST" ]; then
    # clone the git repository
    echo "Cloning $GITSYNC_REPO to $GITSYNC_DEST"
    git clone  --branch $GITSYNC_REF --single-branch $GITSYNC_REPO $GITSYNC_DEST || exit 1
else
    cd $GITSYNC_DEST || echo "Failed to cd to git destination..." && exit 1

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
fi

# sleep for a specified interval (e.g., 1 hour)
sleep $GITSYNC_PERIOD

done