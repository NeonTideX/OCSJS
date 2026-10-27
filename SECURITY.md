# Security

Report sensitive vulnerabilities through this repository's private security advisory channel when available. Avoid posting credentials or private course content in public issues.

OCSJS V1 accepts declarative providers only. It does not evaluate imported handlers. Provider endpoints use HTTPS or loopback HTTP, requests omit cookies, and authentication is supplied explicitly through provider settings. The Custom Providers variant intentionally grants broad request permission; install only the variant you need.

Settings and cached answers stay in userscript-manager storage. Ordinary settings exports remove common credential-bearing fields. Full private exports intentionally include credentials. Logs contain application events rather than general network traffic.

Third-party answer quality, endpoint retention policies, account access and server-side grading are outside the runtime's guarantees. Review provider configuration and generated answers before use.
