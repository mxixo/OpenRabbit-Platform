# Promotion Gates Checklist
## Dev -> Staging
- CI pipeline green for target commit.
- Quality gate script successful.
- Smoke tests executed in staging candidate environment.
- Approval logged by authorized reviewer.
## Staging -> Production
- All Staging gates passed.
- Rollback strategy documented and validated.
- Release window approved.
- Production approval logged by release owner.
