# OpenRabbit production account boundary gate

OpenRabbit production rollout is blocked until `account-boundary.yaml` changes from `status: undesignated` to a deliberately selected, verified Supabase project.

This repository must not infer production identity from whichever project happens to be available, inactive, cheapest, oldest, or most convenient. A project restore or migration is an operational mutation and must happen only after explicit product-boundary designation.

## Designation sequence

1. Record the chosen OpenRabbit Supabase project reference and canonical `https://<project-ref>.supabase.co` origin.
2. Verify the provider reports that exact project identity and a healthy status.
3. Inventory Auth providers/users/session settings and the existing database schema before applying migrations.
4. Confirm the project is a dedicated OpenRabbit boundary and is not shared with WayGo.
5. Change the manifest to `status: designated` with the owner decision and timestamp.
6. Apply and verify the append-only Environment Blueprint migration on that exact project.
7. Configure the server-only project ref/service credential boundary and verify read/write revision-chain behavior.
8. Certify hosted Auth tenant/session isolation and the Google provider lifecycle.
9. Execute rollback/restore rehearsal and attach the rollback record.
10. Only then satisfy `production_account_boundary_designated` and the remaining production preflight gates.

## Fail-closed conditions

Production rollout remains blocked when any of the following is true:

- the manifest is `undesignated`;
- project ref and canonical Supabase origin disagree;
- the provider project is inactive/unhealthy;
- the project is shared with another product boundary such as WayGo;
- Auth/schema inventory has not been reviewed;
- the Environment Blueprint migration has not been verified on the designated project;
- tenant isolation/provider lifecycle certification is incomplete; or
- rollback/restore rehearsal is incomplete.

This gate does not select a project and does not restore, migrate, or write to a cloud database by itself.