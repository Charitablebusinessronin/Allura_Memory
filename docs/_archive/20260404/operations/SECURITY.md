# Security Best Practices

> **Last Updated:** 2026-03-28
> **Threat Model:** Supply Chain Attacks (CanisterWorm, TeamPCP)

## Critical: Why We Use Bun, Not npm

Following the [CanisterWorm attack](https://www.stepsecurity.io/blog/canisterworm-how-a-self-propagating-npm-worm-is-spreading-backdoors-across-the-ecosystem), npm has become a high-risk attack vector:

- **postinstall hooks** execute automatically (malware runs on install)
- **Stolen npm tokens** from CI/CD propagate worms across scopes
- **Self-propagating malware** via compromised dependencies

**Bun eliminates these vectors:**
- No postinstall hooks by default
- Different auth mechanism (not ~/.npmrc tokens)
- Binary lockfile (`bun.lockb`) for reproducible installs
- Faster, cleaner, less targeted by attackers

---

## Package Management Security

### ✅ DO

```bash
# Use Bun exclusively
bun install                    # Install dependencies
bun install --frozen-lockfile  # CI/CD - fail if lockfile changes
bun pm ls                      # Audit installed packages
```

**Commit your lockfile:**
```bash
# bun.lockb must be committed
git add bun.lockb
git commit -m "deps: update lockfile"
```

**Pin exact versions in package.json:**
```json
{
  "dependencies": {
    "some-lib": "1.2.3"     // NOT ^1.2.3 or ~1.2.3
  }
}
```

### ❌ NEVER

```bash
npm install                    # NEVER use npm
npx some-package               # Avoid npx (runs unknown code)
npm install -g package         # Global installs are persistent threats
```

---

## Dependency Security

### Audit Dependencies

```bash
# List all packages
bun pm ls

# Check for known vulnerabilities
bun audit

# Review package before adding
bun pm info package-name
```

### Vet New Dependencies

Before adding any package:

1. **Check maintainer reputation**
   - GitHub stars, contributor count
   - Recent activity (dead packages = risk)
   
2. **Review the package**
   ```bash
   # Download and inspect before installing
   bun pm pack package-name
   tar -xzf package-name-version.tgz
   cat package/package.json | grep -A5 '"scripts"'
   ```
   
3. **Check for postinstall hooks**
   ```json
   // DANGER - has postinstall
   {
     "scripts": {
       "postinstall": "node index.js"  // 🚨 RED FLAG
     }
   }
   ```

4. **Use specific versions only**
   ```bash
   # Good
   bun add package-name@1.2.3
   
   # Bad (floating version)
   bun add package-name
   ```

---

## CI/CD Security

### GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      # Use Bun, NOT npm/node setup
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      
      # CRITICAL: Use frozen lockfile
      - name: Install dependencies
        run: bun install --frozen-lockfile
      
      # Verify no postinstall hooks ran
      - name: Security check
        run: |
          # Check for suspicious files
          test ! -f ~/.local/share/pgmon/service.py || exit 1
          test ! -f ~/.config/systemd/user/pgmon.service || exit 1
          echo "✓ No malware artifacts detected"
      
      - name: Run tests
        run: bun test
```

### Protect Secrets

```yaml
# NEVER log secrets
- name: Build
  run: |
    echo "Building..."
    # DON'T: echo $MY_SECRET
    # DON'T: printenv | grep TOKEN
    bun run build
  env:
    MY_SECRET: ${{ secrets.MY_SECRET }}
```

### Rotate Tokens Regularly

```bash
# If you suspect compromise:

# 1. Rotate GitHub tokens
gh auth refresh

# 2. Check for unauthorized access
gh auth status

# 3. Review active sessions
gh api user/sessions | jq '.[] | .last_active_at'
```

---

## Malware Detection

### CanisterWorm Indicators

Check your system for these artifacts:

```bash
# Check for backdoor files
ls -la ~/.local/share/pgmon/service.py 2>/dev/null && echo "🚨 MALWARE FOUND"
ls -la ~/.config/systemd/user/pgmon.service 2>/dev/null && echo "🚨 MALWARE FOUND"
ls -la /tmp/pglog 2>/dev/null && echo "🚨 PAYLOAD DOWNLOADED"

# Check for C2 connections
netstat -an | grep "icp0.io" || echo "✓ No C2 connections"

# Check running services
systemctl --user list-units | grep pgmon || echo "✓ No suspicious services"
```

### Network Monitoring

```bash
# Monitor outbound connections
sudo tcpdump -i any port 443 | grep icp0.io

# Check DNS queries
dig tdtqy-oyaaa-aaaae-af2dq-cai.raw.icp0.io
```

---

## Development Environment

### Isolated Development

```bash
# Use containers for isolation
docker run -it --rm \
  -v $(pwd):/workspace \
  -w /workspace \
  oven/bun:latest \
  bun install
```

### Pre-commit Hooks

```bash
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: bun-security-check
        name: Security Check
        entry: bash -c '
          # Block npm commands
          if git diff --cached | grep -E "^(\+.*npm|\+.*npx)"; then
            echo "❌ npm/npx commands detected. Use Bun only."
            exit 1
          fi
          
          # Check for postinstall scripts
          if grep -r "postinstall" package.json; then
            echo "❌ postinstall scripts blocked (CanisterWorm vector)"
            exit 1
          fi
        '
        language: system
        pass_filenames: false
```

---

## Supply Chain Verification

### Verify Dependencies

```bash
# Check lockfile integrity
bun install --frozen-lockfile

# Compare with known-good hash
sha256sum bun.lockb > bun.lockb.sha256
git diff bun.lockb.sha256
```

### SBOM (Software Bill of Materials)

```bash
# Generate SBOM
bun pm ls --all > sbom.txt

# Check against known-bad packages
grep -f known-malicious-packages.txt sbom.txt
```

---

## Incident Response

### If You Suspect Compromise

```bash
# 1. ISOLATE - Disconnect from network
sudo ifconfig down

# 2. PRESERVE - Don't delete anything yet
cp -r ~/.local/share ~/.local/share-backup
cp -r ~/.config/systemd ~/.config/systemd-backup

# 3. CHECK - Look for indicators
find ~ -name "pgmon*" -o -name "*canister*" 2>/dev/null

# 4. ROTATE - All secrets immediately
# - GitHub tokens
# - Database passwords
# - API keys
# - SSH keys

# 5. REPORT
git log --since="1 week ago" --stat
```

### Clean System Procedure

```bash
# 1. Stop suspicious services
systemctl --user stop pgmon.service 2>/dev/null

# 2. Remove malware files
rm -rf ~/.local/share/pgmon
rm -f ~/.config/systemd/user/pgmon.service
rm -f /tmp/pglog /tmp/.pg_state

# 3. Clean npm cache (if npm was ever used)
rm -rf ~/.npm
rm -f ~/.npmrc

# 4. Verify Bun is clean
which bun
bun --version

# 5. Fresh install with Bun
rm -rf node_modules bun.lockb
bun install
```

---

## References

- [CanisterWorm Analysis](https://www.stepsecurity.io/blog/canisterworm-how-a-self-propagating-npm-worm-is-spreading-backdoors-across-the-ecosystem)
- [Bun Security Documentation](https://bun.sh/docs/cli/install)
- [Supply Chain Security Best Practices](https://docs.github.com/en/code-security/supply-chain-security)

---

**Remember:** 
- ✅ Bun only
- ❌ npm never  
- 🔒 Commit lockfile
- 🛡️ Vet every dependency
