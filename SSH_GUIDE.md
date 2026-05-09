# 🚀 PijulServ SSH Usage Guide

Welcome to your own Pijul hosting platform! To ensure a smooth experience when cloning or pushing via SSH, please follow these steps.

## 1. Generate a Modern SSH Key
The server is configured with high security. We strongly recommend using **Ed25519** keys.

```bash
# Generate a new key (replace 'pijul' with any name you like)
ssh-keygen -t ed25519 -f ~/.ssh/id_pijul
```

## 2. Add your Public Key to the Web UI
1.  Copy your **public** key content:
    ```bash
    cat ~/.ssh/id_pijul.pub
    ```
2.  Log in to the PijulServ Web UI.
3.  Go to **Settings** -> **SSH Keys**.
4.  Paste your key and give it a name (e.g., "My Laptop").

## 3. Set Up Your SSH Agent (Crucial!)
To prevent the server from timing out while you type your passphrase, use an SSH agent.

### For Bash/Zsh:
```bash
eval $(ssh-agent -s)
ssh-add ~/.ssh/id_pijul
```

### For Fish Shell:
```fish
ssh-agent -c | source
ssh-add ~/.ssh/id_pijul
```

## 4. Repository Permissions
Even if your key is correct, you **must** have permission to the repository.
*   **Public Repos**: Anyone with a registered key can read.
*   **Private Repos**: You must be the owner or added as a collaborator in the Web UI.

## 5. Cloning a Repository
Always use the system user `abhay` and the correct repository path.

```bash
pijul clone abhay@<server-ip>:/<repository-name>
```

---

## 🛠️ Troubleshooting

### "Permission denied (publickey)"
*   Double check that the **Public Key** in the Web UI matches your `~/.ssh/id_pijul.pub`.
*   Ensure you are using the correct system username (`abhay`).

### "Timeout before authentication"
*   This happens if you take too long to type your passphrase. 
*   **Solution**: Use the SSH Agent steps in Section 3.

### "Access Denied" or "Not authenticated"
*   Ensure the repository exists in the `repos/` directory.
*   Verify that your Web UI username is added as a **Collaborator** in the repository settings.
*   Check that you have the required role (e.g., "developer" to push).

### "Only Pijul commands are allowed"
*   This means you tried to run a normal shell command (like `ls` or `id`) over SSH.
*   **Solution**: This is intended! This server only allows Pijul operations for security.
