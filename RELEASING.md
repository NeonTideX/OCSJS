# Publishing releases

1. Use Node.js 26 and pnpm 12.14.0. Install dependencies with pnpm install --frozen-lockfile.
2. Synchronize the root and workspace package versions for runtime releases, update CHANGELOG.md, and preserve all license and upstream notices.
3. Run pnpm lint, pnpm tsc, pnpm test, and pnpm build. Record relevant manual userscript-manager tests separately. The optional answerer suite needs private local configuration and is not part of public CI.
4. Commit the source and lockfile, push, and wait for CI on that exact commit.
5. Create and push an annotated vX.Y.Z tag matching the root package version.
6. Run the Build and Publish Release workflow with that existing tag. It verifies the tag/version match, rebuilds, adds SHA256SUMS, and publishes English notes from the matching changelog entry.
7. Verify the downloadable userscripts and checksums. The release includes the standard and common variants, metadata, bundles, stylesheet, project license, and upstream notices. GitHub provides source archives containing the complete source and build instructions.

Published releases and tags are immutable. The workflow refuses to update an existing release. Maintainers may refresh an unpublished draft before its first publication. Never publish the development variant, which contains local file references.

The standard userscript is the default installation. The common variant has broader network permissions. Keep the existing upstream attribution and third-party notices with distributed artifacts.
