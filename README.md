# Star Atlas

A personal GitHub Stars index with search, topic navigation, reading notes, and an encrypted catalog. Hosted as a static site on GitHub Pages.

The site assets are public. Repository metadata, original list labels and curated introductions are stored inside `docs/data/vault.json`, encrypted with AES-256-GCM. A passphrase derives the key with PBKDF2-SHA-256 (600,000 iterations and a random salt). The passphrase is not stored in this repository. Unlocking happens in the browser through Web Crypto.

GitHub Actions refreshes public starred repositories every six hours using its repository-scoped token, encrypts the result, and rebuilds Pages. The **Sync GitHub** button loads the latest encrypted published snapshot without contacting GitHub's API from the browser. Original list membership and curated introductions come from the local classified snapshot. Notes and manual topic changes remain in the current browser and can be backed up using JSON export.

To update the published snapshot, run the local GitHub sync, then from this repository:

```sh
node scripts/pack.mjs /path/to/local/star-atlas /path/to/access-password.txt
git add docs
git commit -m 'Refresh encrypted catalog'
git push
```

`pack.mjs` accepts a UTF-8 file containing only the access passphrase. Keep that file and the plaintext local catalog outside this repository. Publishing a fresh snapshot changes the encryption salt, so the new published snapshot replaces any older browser cache.

For GitHub Pages, publish branch `main`, folder `/docs`. The site does not require a server or third-party frontend packages. Anyone with the access passphrase can unlock the published catalog. This is a shared access key, not GitHub OAuth or per-user authentication.

The refresh workflow needs repository secret `ATLAS_ACCESS_PASSWORD`, containing the catalog access passphrase. It never uses a personal GitHub token. Private list labels remain in the encrypted snapshot and are not written to job logs.
