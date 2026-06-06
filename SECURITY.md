# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report privately through GitHub's [private vulnerability reporting](https://github.com/kew-sh/kew/security/advisories/new)
(the **Security → Report a vulnerability** button on the repository), or, if you
prefer, contact the maintainer via [kew.sh](https://kew.sh).

We aim to acknowledge a report within 72 hours and to ship a fix or mitigation as
fast as the severity warrants. We will keep you posted and credit you in the
published advisory once the issue is resolved, unless you ask us not to.

## What to include

- A clear description of the issue and its impact.
- Steps to reproduce: a proof of concept, the affected version(s), and the relevant
  configuration.
- Any suggested remediation, **described in prose** — see the note below.

## Please describe the fix, don't send a patch

To keep Kew's licensing chain clean, we ask that security reports **describe** the
vulnerability and the suggested remediation rather than attach a code patch.

If you submit code — here or in a pull request — it is treated as a Contribution
under our [Contributor License Agreement](CLA.md) and the
[Functional Source License](LICENSE). A described fix lets us implement and ship the
remedy with no ambiguity over rights, which means a faster fix for everyone.

## Supported versions

Security fixes are provided for the latest released version of Kew. Older versions
convert to the Apache License 2.0 two years after their release (see [LICENSE](LICENSE))
and are not separately maintained.
