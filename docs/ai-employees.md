# AI Employees: brothersof1-5-1.org

Status: planning (2026-11-12). Owner: Kenneth.

## What an AI employee is

An **AI employee** is an AI agent with a clear job description, a fixed set of tools, a human supervisor (Kenneth) and a record of everything it does. It does real work, but it never has the final say on money, legal, customer or account decisions.

This is the **shared Elliottz LLC plan** used by every app (Kelviz, Riydez, Black Spend, brothersof1-5-1.org). Sections 1-4 are identical in every repo; section 5 onward is specific to this app. Full detail on the operations employees lives in Elliottz LLC's private operations docs.

There are two groups:

- **Product employees** run inside one app and work for that app's users.
- **Operations employees** work for Elliottz LLC across all apps from one separate internal service (working name "Elliottz Ops"), never inside a customer-facing app, because they need business-level access (GitHub, logs, reports across apps) that must never sit next to customer data.

## 1. Org chart

```
                         Kenneth (approves, decides)
                                    │
                           Ops Dashboard (later)
                                    │
                        Supervisor (manages all)
   ┌───────────┬───────────┬────────┴──┬────────────┬────────────┬───────────┐
 Product     Security    Error       GitHub       Opportunity  Business
 employees   Sentinel    Monitor     Upgrade      Scout        assistants
 (one set    (all apps,  (all apps)  Monitor      (all         (support,
 per app)    24/7)                   (all repos)  industries)  content)
```

## 2. Ground rules (every AI employee, every app)

1. **A person approves anything that moves money or makes a commitment** (payments, invoices, notices, messages to users, account or billing changes). The AI prepares; a human clicks.
2. **Scoped like every other request.** A product employee acts for one tenant (org, chapter or member) taken from the signed-in session, never from its own output, and only through the app's normal service layer, so the app's access rules (RLS, roles) still apply. No direct database access or admin shortcuts.
3. **Every action is audited** in the app's audit log, marked with which employee, which model and on whose behalf.
4. **Shows its reasoning:** each suggestion carries a short plain-language reason and the evidence used.
5. **Provider behind one interface** (Elliottz LLC host portability standard), so the model or vendor can change without touching features.
6. **Cost and rate limits per tenant,** with a monthly cap and a kill switch per employee.
7. **Privacy first:** personal data is sent to an AI provider only when the job needs it and only after the privacy policy and any provider disclosure cover it; names, emails, plates, receipts and tokens are stripped wherever a summary will do.
8. **Accessible and tested:** any new screen meets the accessibility standard (WCAG 2.2 AA); every employee has automated evaluation tests on fixed sample data before it touches real users.
9. **Off by default** for users until a tenant admin turns it on; always labelled as AI.
10. **Reports to the Supervisor and the dashboard** in the shared record format (section 4).
11. **Least privilege, separated by group:** product employees see only their tenant's data; operations employees see only business tools and totals, never raw user records. Separate credentials per employee.
12. **Only the Security Sentinel may act without waiting for approval,** and only through playbooks Kenneth approved in advance that are defensive, reversible and expire on their own. Every other employee only proposes.

## 3. Operations employees (shared, run from Elliottz Ops)

| Employee                     | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                        | Never does                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Supervisor**               | Roster of every employee; watches failed runs, slow approvals, cost against caps (warns at 80%); auto-pauses an employee on a cost or error spike; daily digest                                                                                                                                                                                                                                                                                     | Approve proposals or un-pause on its own                           |
| **Security Sentinel (24/7)** | Watches for attacks (traffic floods, sign-in abuse, webhook forgery, access-denied spikes, risky role changes, leaked secrets, misbehaving AI employees). Tier 1, pre-approved, reversible, auto-expiring: block or rate-limit attacking addresses, turn on the host's attack challenge, tighten sign-in limits, pause an AI employee. Tier 2 needs Kenneth: rotate keys, sign everyone out, lock accounts, maintenance mode. Watch-only mode first | Change data or security policies, turn off monitoring, "hack back" |
| **Error Monitor**            | Groups and ranks errors by impact, finds the cause, writes a fix proposal (diff, risk, test). Two approvals, both Kenneth's: approve the proposal, then review and merge the PR it opens                                                                                                                                                                                                                                                            | Merge, deploy, roll back or edit data                              |
| **GitHub Upgrade Monitor**   | Watches every repo and the core stack's releases; rates risk, explains changes, drafts migrations for breaking upgrades, recommends merge order                                                                                                                                                                                                                                                                                                     | Merge or change repo settings                                      |
| **Opportunity Scout**        | Weekly evidence-backed brief of features and new product ideas across Kenneth's industries, from public sources and app-wide totals                                                                                                                                                                                                                                                                                                                 | Read individual user records; scrape behind logins                 |
| **Business assistants**      | Support, onboarding and content drafts for Kenneth to approve                                                                                                                                                                                                                                                                                                                                                                                       | Post or send anything automatically                                |

## 4. Shared record format (for the Supervisor and the Ops Dashboard)

| Record       | Key fields                                                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Employee** | id, name, group, app, job description, schedule, status (on / paused / off), model and provider, monthly cost cap                               |
| **Run**      | id, employee, app, tenant (product employees only), started, finished, status, cost, items handled, error summary                               |
| **Proposal** | id, employee, run, type, summary, reason, evidence links, status (waiting / approved / edited / rejected), decided by, decided at               |
| **Report**   | id, employee, period, title, body, links                                                                                                        |
| **Incident** | id, employee, app, detected at, kind (cost cap / error spike / missed run / attack), severity, action taken, expires at, undone by, resolved at |

## 5. This site: brothersof1-5-1.org

This repository is **public**, so this file stays high-level on purpose: no credentials, endpoints, thresholds or security playbook details belong here. Those live in the private operations repo.

### Product employees (to do)

- [ ] **Content and Events Assistant:** drafts event posts, news and announcements as WordPress drafts; a chapter officer reviews and publishes. Nothing is published automatically.
- [ ] **Events Keeper:** flags past events still shown as upcoming, missing details (time, place, link) and broken links, and drafts the fixes.
- [ ] **Members Portal Helper** (after the members portal launches): answers members' questions from approved chapter content and hands off to an officer when unsure; sees only what that member can already see.
- [ ] **Site Health:** watches WordPress core, plugin and theme updates and server software versions (for example the database version noted in the WordPress operations docs), and drafts the update plan; an officer or Kenneth applies updates on staging first.

### What this site provides to the operations employees (to do)

- [ ] A simple health check the Supervisor and Error Monitor can call, plus error reporting from the Angular server and WordPress
- [ ] Security signals: WordPress sign-in failures and other abuse patterns. WordPress sites are a common target, and the Security Sentinel's Tier 1 actions need a firewall it can control; the current hosting setup needs a decision on how that's provided before Tier 1 can apply here
- [ ] GitHub Upgrade Monitor covers this repo (Angular); WordPress updates are covered by the Site Health employee above
