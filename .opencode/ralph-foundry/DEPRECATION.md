# Ralph Foundry Deprecation Policy

> [!NOTE]
> **AI-Assisted Documentation**
> Portions of this document were drafted with the assistance of an AI language model.
> Content has not yet been fully reviewed — this is a working design reference, not a final specification.
> AI-generated content may contain inaccuracies or omissions.
> When in doubt, defer to the source code, JSON schemas, and team consensus.

## Current Version

Ralph Foundry v0.1.0 is the current contract version.

## Supersession

v1.0.0 may supersede v0.1.0 only after at least one dry-run proves the manifest, run event, and result contracts end-to-end.

## Rollback

To roll back from a later schema version:

1. Restore the v0.1.0 schema files in `json-schema/`.
2. Restore manifests to `schemaVersion: "0.1.0"`.
3. Re-run JSON syntax validation and the project typecheck.

## Drift Audit Owner

Knuth owns schema drift audit for Foundry contracts. Until automation exists, review monthly or before any real-execution Foundry run.
