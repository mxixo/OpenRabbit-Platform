# Repository visibility, licensing, and IP release boundary

OpenRabbit Core is currently hosted in a public GitHub repository and the repository advertises the MIT License. That configuration may be completely intentional, but it is a material commercial/product-distribution decision and must not be treated as an incidental implementation detail.

The production release packet therefore includes `repository_visibility_license_ip_reviewed`. This gate remains blocked until the product owner and, where appropriate, counsel explicitly review the intended source-distribution model, current repository visibility, license grant, third-party dependency/license obligations, trademark/brand treatment, and which components (if any) are intended to remain proprietary.

The gate does **not** automatically make the repository private, change or revoke an existing license, rewrite commit history, or assert that previously published material can be made unpublished. It exists to prevent a commercial `go` decision from proceeding while the source/IP posture is merely assumed.

Evidence for passing the gate should record the reviewed repository/ref, observed visibility and license at review time, the intended distribution model, reviewer/owner attribution, and any required follow-up actions. Secrets, credentials, customer data, and private keys remain prohibited from source control regardless of the chosen source-license strategy.
