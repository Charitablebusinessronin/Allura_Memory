# Security Incident Report: Credential Exposure

**Date:** 2026-04-06  
**Severity:** CRITICAL  
**Status:** REMEDIATION IN PROGRESS

## Summary

Environment files containing live credentials were committed to git and pushed to GitHub repository `Charitablebusinessronin/Allura_Memory`.

## Exposed Credentials

| Credential Type | Status | Action Required |
|-----------------|--------|-----------------|
| PostgreSQL password | EXPOSED | **ROTATE IMMEDIATELY** |
| Neo4j password | EXPOSED | **ROTATE IMMEDIATELY** |
| Ollama API key | EXPOSED | **REGENERATE IMMEDIATELY** |

## Immediate Actions Taken

1. ✅ Removed `.env`, `.env.local`, `.env.decrypted`, `.env.example` from git tracking
2. ✅ Updated `.gitignore` with comprehensive `.env` ignore patterns
3. ✅ Installed pre-commit hook to prevent future credential leaks
4. ✅ Committed security fix to local repository

## Actions Required (URGENT)

### 1. Rotate All Credentials

```bash
# PostgreSQL
docker exec -it knowledge-postgres psql -U ronin4life -d memory
ALTER USER ronin4life WITH PASSWORD 'new_secure_password_here';

# Neo4j
docker exec -it knowledge-neo4j cypher-shell -u neo4j -p "old_password"
# Then change password via Neo4j Browser at http://localhost:7474

# Ollama
# Regenerate API key at https://ollama.com
```

### 2. Clean Git History

```bash
# Install BFG Repo-Cleaner
sudo apt install bfg  # or brew install bfg on macOS

# Remove .env files from entire git history
bfg --delete-files .env
bfg --delete-files .env.local
bfg --delete-files .env.decrypted

# Force push to overwrite GitHub history
git push origin --force --all
git push origin --force --tags
```

### 3. Update Local Environment Files

After rotating credentials, update your local `.env` files:

```bash
# Copy template
cp .env.example .env.local

# Edit with new credentials
nano .env.local
```

### 4. Verify GitHub Security

1. Go to: `https://github.com/Charitablebusinessronin/Allura_Memory/security`
2. Check for secret scanning alerts
3. Mark secrets as "revoked" after rotation

## Prevention Measures

1. **Pre-commit Hook**: Installed at `.githooks/pre-commit`
2. **Gitignore**: Comprehensive `.env` ignore patterns
3. **Template File**: `.env.example` with placeholder values only

## Lessons Learned

1. Never commit `.env` files with real credentials
2. Use `.env.example` with placeholder values for templates
3. Install pre-commit hooks to catch accidental commits
4. Rotate credentials immediately upon exposure

## References

- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)
- [git-filter-repo](https://github.com/newren/git-filter-repo)