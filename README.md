# nodered-git-sync
A lightweight sidecar to reload nodered flows

Checklist
 - You get so nervous editing flows because you just know you're gonna break something
 - You have a development nodered instance where you make your changes. You use Nodered Projects to push to git.
 - You want to push your changes to your production instance by merging into a "prod" branch (for example).

### Public nodered project repo
put here: [nodered values.yaml](https://github.com/SchwarzIT/node-red-chart/blob/main/charts/node-red/values.yaml)
```yaml
extraSidecars:
- name: git-sync
  image: ghcr.io/beasteers/nodered-git-sync:main
  env:
  # git options
  - name: GITSYNC_REPO
    value: https://github.com/me/my-repo
  - name: GITSYNC_REF
    value: prod
  - name: GITSYNC_PERIOD
    value: "5m"

  # nodered API credentials (to reload)
  - name: NODERED_USERNAME
    value: admin
  - name: NODERED_PASSWORD
    valueFrom:
      secretKeyRef:
      key: ADMIN_PASSWORD
      name: nodered-auth

  volumeMounts: 
  # mount nodered's directory
  - name: data
    mountPath: /data
  securityContext:
    runAsGroup: 65533  # git-sync user id
```

Put your credentials in a secret so you can access them from the container.
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: nodered-auth
  namespace: cluster-config
data:
  ADMIN_USERNAME: admin
  ADMIN_PASSWORD: boop
  POSTGRES_USER: admin
  POSTGRES_PASS: boop
```

### If your repo is private
```yaml
extraSidecars:
- name: git-sync
  image: ghcr.io/beasteers/nodered-git-sync:main
  env:
  # git options
  - name: GITSYNC_REPO
    value: git@github.com:me/my-repo
  - name: GITSYNC_REF
    value: main
  - name: GITSYNC_SSH
    value: "true"
  - name: GITSYNC_PERIOD
    value: "5m"

  # nodered API credentials (to reload)
  - name: NODERED_USERNAME
    value: admin
  - name: NODERED_PASSWORD
    valueFrom:
      secretKeyRef:
      key: ADMIN_PASSWORD
      name: nodered-auth

  volumeMounts: 
  # git ssh credentials (to pull)
  - name: git-nodered-ssh-key
    mountPath: /etc/git-secret
  # mount nodered's directory
  - name: data
    mountPath: /data
  securityContext:
    runAsGroup: 65533  # git-sync user id

extraVolumes:
# git ssh credentials
- name: git-nodered-ssh-key
  secret:
      secretName: git-nodered-ssh-key   
```

Put your credentials in a secret so you can access them from the container.
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: nodered-auth
  namespace: cluster-config
data:
  ADMIN_USERNAME: admin
  ADMIN_PASSWORD: boop
  POSTGRES_USER: admin
  POSTGRES_PASS: boop
---
apiVersion: v1
kind: Secret
metadata:
  name: git-nodered-ssh-key
  namespace: cluster-config
type: Opaque
stringData:
  ssh: |
    -----BEGIN OPENSSH PRIVATE KEY-----
    ...
    -----END OPENSSH PRIVATE KEY-----
  known_hosts: |
    github.com ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBEmKSENjQEezOmxkZMy7opKgwFB9nkt5YRrYMjNuG5N87uRgg6CLrbo5wAdT/y6v0mKV0U2w0WZ2YB/++Tpockg=
    github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl
    github.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQCj7ndNxQowgcQnjshcLrqPEiiphnt+VTTvDP6mHBL9j1aNUkY4Ue1gvwnGLVlOhGeYrnZaMgRK6+PKCUXaDbC7qtbW8gIkhL7aGCsOr/C56SJMy/BCZfxd1nWzAOxSDPgVsmerOBYfNqltV9/hWCqBywINIR+5dIg6JTJ72pcEpEjcYgXkE2YEFXV1JHnsKgbLWNlhScqb2UmyRkQyytRLtL+38TGxkxCflmO+5Z8CSSNY7GidjMIZ7Q4zMjA2n1nGrlTDkzwDCsw+wqFPGQA179cnfGWOWRVruj16z6XyvxvjJwbz0wQZ75XK5tKSb7FNyeIEs4TT4jk+S4dhPeAUC5y+bDYirYgM4GC7uEnztnZyaVWQ7B381AK4Qdrwt51ZqExKbQpTUNn+EjqoTwvqNj4kqx5QUCI0ThS/YkOxJCXmPUWZbhjpCg56i+2aB6CmK2JGhn57K5mj0MNdBXA4/WnwH6XoPWJzK5Nyu2zB3nAZp+S5hpQs+p1vN1/wsjk=
```