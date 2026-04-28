---
description: Setup Git SSH keys on the remote server for repository synchronization
---

This workflow guides you through generating an SSH key on the remote server and adding it to GitHub to enable `git pull` without password prompts.

// turbo-all

1. Generate a new SSH key on the remote server

```bash
expect -c "
spawn ssh -o StrictHostKeyChecking=no root@76.13.183.75 \"ssh-keygen -t rsa -b 4096 -C 'deploy_key' -N '' -f ~/.ssh/id_rsa\"
expect \"password:\"
send \"Sunflower@7-bloom\r\"
expect eof
"
```

2. Display the Public Key

Copy the output below and add it to your [GitHub SSH Keys](https://github.com/settings/keys) or repository [Deploy Keys](https://github.com/settings/keys).

```bash
expect -c "
spawn ssh -o StrictHostKeyChecking=no root@76.13.183.75 \"cat ~/.ssh/id_rsa.pub\"
expect \"password:\"
send \"Sunflower@7-bloom\r\"
expect eof
"
```

3. Configure Git Identity on the remote server

```bash
expect -c "
spawn ssh -o StrictHostKeyChecking=no root@76.13.183.75 \"git config --global user.email 'deploy@example.com' && git config --global user.name 'Deploy Bot'\"
expect \"password:\"
send \"Sunflower@7-bloom\r\"
expect eof
"
```

4. Test GitHub Connection

```bash
expect -c "
spawn ssh -o StrictHostKeyChecking=no root@76.13.183.75 \"ssh -T git@github.com\"
expect \"password:\"
send \"Sunflower@7-bloom\r\"
expect \"Are you sure you want to continue connecting\"
send \"yes\r\"
expect eof
"
```

5. Update Remote Origin to use SSH

```bash
expect -c "
spawn ssh -o StrictHostKeyChecking=no root@76.13.183.75 \"cd /root/.openclaw/workspace/hotel-webscrap-v2 && git remote set-url origin git@github.com:$(git remote get-url origin | sed 's/.*github.com[:\/]//')\"
expect \"password:\"
send \"Sunflower@7-bloom\r\"
expect eof
"
```
