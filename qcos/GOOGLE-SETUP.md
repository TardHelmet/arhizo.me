# Google configuration for The QCOS Online

These are the values to enter in the Google Cloud console so the OAuth consent
screen and domain verification pass review. The pages they point at live in this
directory and are served by GitHub Pages from the repository root at
`https://arhizo.me/`.

## 1. Domain verification (Search Console)

The OAuth consent screen will only accept authorised domains that are verified
to the same Google account.

1. Go to <https://search.google.com/search-console> and add `arhizo.me` as a
   **URL prefix** property (`https://arhizo.me/`).
2. Choose the **HTML file** verification method. Google gives you a file named
   `google<hash>.html`.
3. Commit that file to the **repository root** (next to `index.html`), not to
   this directory. It must be reachable at `https://arhizo.me/google<hash>.html`.
4. Click Verify. Leave the file in place permanently — removing it un-verifies
   the domain.

The DNS TXT method also works and is done at the domain registrar (the domain is
on Squarespace Domains) instead of in this repository.

## 2. OAuth consent screen (Google Auth Platform → Branding)

| Field | Value |
| --- | --- |
| App name | `The QCOS Online` |
| User support email | `b@arhizo.me` |
| App logo | optional |
| Application home page | `https://arhizo.me/qcos/` |
| Application privacy policy link | `https://arhizo.me/qcos/privacy.html` |
| Application terms of service link | `https://arhizo.me/qcos/terms.html` |
| Authorised domain | `arhizo.me` |
| Developer contact email | `b@arhizo.me` |

The app name must match the name shown on the home page exactly. The home page
at `/qcos/` is titled **The QCOS Online**, states what the app does, and is
publicly reachable with no sign-in — the three things the review checks for.
The root page at `https://arhizo.me/` also carries the name, a one-line
description, and links to both policies, so the review passes whichever of the
two URLs is configured as the home page.

## 3. Scopes

Only the basic OpenID Connect scopes are requested, and the privacy policy is
written to match:

- `openid`
- `.../auth/userinfo.email`
- `.../auth/userinfo.profile`

These are non-sensitive, so no security assessment is required. **Adding any
sensitive or restricted scope** (Gmail, Drive, Calendar, Contacts) would trigger
a full verification process and would make section 3 of the privacy policy
inaccurate — update `privacy.html` first if that ever changes.

## 4. If the review is rejected again

The four findings from the last review and what addresses each:

| Finding | Fix |
| --- | --- |
| Privacy policy lacks sufficient content | `/qcos/privacy.html` — itemises every category collected, the Google data received, retention periods, deletion, and the Limited Use disclosure |
| Home page behind a login page | `/qcos/` is static and public; the root page now renders product text without JavaScript |
| Home page does not explain the app's purpose | `/qcos/` opens with what the app is and what it does |
| App name does not match the home page | Both `/qcos/` and the root page name the app "The QCOS Online" — set the console's app name to exactly that string |

After deploying, confirm each URL returns 200 in a private window before
resubmitting, and allow time for GitHub Pages to rebuild.
