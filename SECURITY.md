# Security Policy

## Supported versions

Addons Studio is currently Alpha. Security fixes are applied to the latest code on `main`; older development snapshots are not supported.

## Reporting a vulnerability

Please use GitHub’s private vulnerability-reporting or Security Advisory flow for this repository when available. Do not publish exploit details, private project data, or proof-of-concept payloads in a public issue.

Include:

- the affected browser and operating system;
- the Addons Studio version or commit;
- steps to reproduce;
- the expected and actual behavior;
- the potential impact on local project data, PWA caching, or imported files.

You should receive an acknowledgment through GitHub as soon as a maintainer reviews the report. A fix may be coordinated privately before public disclosure.

## Current security model

Alpha `0.0.4.3` has no user accounts, cloud synchronization, server API, add-on export, code execution editor, or collaboration system. Projects, folders, internal model data, modeling references, project materials, texture-image blobs, and face/UV bindings stay in the browser’s IndexedDB. Imported project icons are restricted to PNG/JPG and capped at 2 MB; reference/background images are restricted to PNG/JPG and capped at 12 MB; Texture Core images are restricted to PNG/JPG, 16 MB, 4096 pixels per side, and 16 megapixels. Images are decoded by the browser before use, and runtime object URLs are revoked when no longer needed.

Users remain responsible for their device and browser security. Clearing site data can remove local projects.
