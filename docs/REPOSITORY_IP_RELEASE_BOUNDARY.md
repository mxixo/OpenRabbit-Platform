# Repository visibility, licensing, and IP release boundary

OpenRabbit Core is currently hosted in a public GitHub repository and the repository advertises the MIT License. That configuration may be completely intentional, but it is a material commercial/product-distribution decision and must not be treated as an incidental implementation detail.

The production release packet therefore includes `repository_visibility_license_ip_reviewed`. This gate remains blocked until the product owner and, where appropriate, counsel explicitly review the intended source-distribution model, current repository visibility, license grant, third-party dependency/license obligations, trademark/brand treatment, and which components (if any) are intended to remain proprietary.

The gate does **not** automatically make the repository private, change or revoke an existing license, rewrite commit history, or assert that previously published material can be made unpublished. It exists to prevent a commercial `go` decision from proceeding while the source/IP posture is merely assumed.

Because the repository is public, the release packet separately requires `repository_history_secret_scan_verified`. That evidence must cover repository history rather than only the current working tree and must prove that exposed credentials, tokens, private keys, customer data, or similar secrets are either absent or have been remediated and rotated. A clean current file tree alone is not enough evidence for that gate.

Evidence for the IP gate should record the reviewed repository/ref, observed visibility and license at review time, the intended distribution model, reviewer/owner attribution, and any required follow-up actions. Evidence for the secret-history gate should identify the scan scope/tool and remediation status without committing secret values into the repository.
