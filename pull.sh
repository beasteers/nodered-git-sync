#!/bin/sh

# create user
id -un || echo "git-sync:x:$(id -u):$CGID::$HOME:/sbin/nologin\n" >> /etc/passwd
id

# git config --global --add safe.directory /git

if [ -z "$GITSYNC_REPO" ]; then
echo "Please set GITSYNC_REPO=https://github.com/your-git-repository"
    exit 1
fi

GITSYNC_BACKUP_DIR="${GITSYNC_BACKUP_DIR:-/backup}"
GITSYNC_ROOT=$(realpath "${GITSYNC_ROOT:-/git}")

echo "# ---------------------------------- config ---------------------------------- #"
echo "Git Remote URL: $GITSYNC_REPO"
echo "Git Destination Folder: $GITSYNC_ROOT"
echo "Pull period (seconds): $GITSYNC_PERIOD"
echo "Exec command: $GITSYNC_EXECHOOK_COMMAND"

# check - does the directory exist and is not empty? if yes, backup the files and delete
# BUT!! if the git repo is from "$GITSYNC_REPO" then don't do anything
if [ -d "$GITSYNC_ROOT" ]; then
    echo "# ---------------------------------------------------------------------------- #"
    echo "Git Destination \"$GITSYNC_ROOT\" already exists:"
    ls -lah $GITSYNC_ROOT

    REMOTE_URL="$([ -d "$GITSYNC_ROOT/.git" ] && git -C "$GITSYNC_ROOT" remote get-url origin)"
    echo "---"
    echo "Detected Remote URL: $REMOTE_URL"
    echo "Desired Remote URL: $GITSYNC_REPO"
    if [ "$REMOTE_URL" = "$GITSYNC_REPO" ]; then
        echo "hmm Looks good to me!"
    else
        # back up the files
        echo "# ------------------------- backing up existing files ------------------------ #"
        bkp=$GITSYNC_BACKUP_DIR/$(date +"%Y%m%d-%H%M%S")
        echo "I'm not really sure what's up with the files so I'm going to move them"
        echo "Backup destination: $bkp"
        cp -r "$GITSYNC_ROOT" "$bkp" && find "$GITSYNC_ROOT" -mindepth 1 -delete  
        ls -lah "$bkp"
        echo
        echo "Git destination is now clean:"
        ls -lah "$GITSYNC_ROOT"
    fi
fi

while true; do

# 
if [ ! -d "$GITSYNC_ROOT/.git" ]; then
    # clone the git repository
    echo "# ---------------------------------- Cloning --------------------------------- #"
    echo "Cloning $GITSYNC_REPO to $GITSYNC_ROOT"
    mkdir -p "$GITSYNC_ROOT"
    git clone --branch $GITSYNC_REF --single-branch $GITSYNC_REPO $GITSYNC_ROOT || exit 1
    echo "# ---------------------------------------------------------------------------- #"
fi

cd $GITSYNC_ROOT
echo "--"
echo "Checking at $(date)"

# check if there are local changes. do nothing to avoid merge conflicts.
if git status -uno --porcelain | grep -q .; then
    echo "We have local uncommitted changes!"
    echo "Please commit your changes before we can pull. I don't want to cause any trouble here."
else
    # git pull --dry-run --rebase
    git fetch origin
    if [ -n "$(git rev-list HEAD..origin/"$GITSYNC_REF")" ] && git pull --dry-run --rebase; then
        # git pull
        echo "Pulling from $GITSYNC_REPO"
        if git pull --rebase; then
            echo "# --------------------------------- Changes! --------------------------------- #"
            # run update script only when git pulls anything successfully
            [ ! -z $GITSYNC_EXECHOOK_COMMAND ] && echo "Running $GITSYNC_EXECHOOK_COMMAND" && $GITSYNC_EXECHOOK_COMMAND
            echo "# ---------------------------------------------------------------------------- #"
        fi
    else
        echo "No changes to pull"
    fi
fi

# sleep for a specified interval (e.g., 1 hour)
echo "Sleeping for $GITSYNC_PERIOD seconds..."
sleep $GITSYNC_PERIOD

done

# git merge-tree $(git merge-base "origin/$GITSYNC_REF" "$GITSYNC_REF") master "$GITSYNC_REF"