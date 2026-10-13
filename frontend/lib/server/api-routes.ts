/**
 * Every backend path the web app is allowed to reach, and nothing else.
 *
 * The proxy is a deny-by-default allowlist: the browser never learns the backend host, and a path
 * nobody listed here is a 404 rather than a hole. The cost of that is a step everyone forgets —
 * adding an endpoint to the API and to the client, then watching the page fail with "Unknown API
 * path". `api-routes.test.ts` closes that gap by checking this list against what the client
 * actually calls, so a forgotten entry fails a test rather than a page.
 */

const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
/** Stakeholder keys are lowercase slugs, e.g. `regional_government`. */
const SLUG = '[a-z_]+'

export type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export const ALLOWED: ReadonlyArray<{ method: Method; path: RegExp }> = [
  { method: 'GET', path: /^health(\/ready)?$/ },
  { method: 'GET', path: /^drought\/(map|cell|watershed|horizon|metrics)$/ },
  { method: 'POST', path: /^drought\/cell$/ },
  { method: 'POST', path: /^advisories\/evaluate$/ },
  { method: 'GET', path: /^enso\/outlook$/ },
  { method: 'GET', path: /^crop-yield\/(outlook|model|enso-impact|timeline)$/ },
  { method: 'POST', path: /^crop-yield\/simulate$/ },
  // account
  { method: 'GET', path: /^auth\/me$/ },
  { method: 'PATCH', path: /^auth\/me$/ },
  { method: 'POST', path: /^auth\/me\/password$/ },
  // farms
  { method: 'GET', path: /^farms$/ },
  { method: 'POST', path: /^farms$/ },
  { method: 'GET', path: new RegExp(`^farms/${UUID}$`) },
  { method: 'PATCH', path: new RegExp(`^farms/${UUID}$`) },
  { method: 'DELETE', path: new RegExp(`^farms/${UUID}$`) },
  { method: 'GET', path: new RegExp(`^farms/${UUID}/advisory$`) },
  // what the platform is built from (staff)
  { method: 'GET', path: /^system\/data-sources$/ },
  // dashboards
  { method: 'GET', path: /^dashboard\/(farmer|ministry)$/ },
  { method: 'POST', path: new RegExp(`^dashboard/farmer/advisories/${UUID}/acknowledge$`) },
  // analytics (staff; the service enforces the role and, where configured, the district scope)
  { method: 'GET', path: /^analytics\/metabase\/(status|embed)$/ },
  { method: 'GET', path: /^analytics\/connection$/ },
  // the front door: a sales enquiry from somebody who has never signed in, a farmer asking to
  // leave the free tier, and the inbox an administrator works through
  { method: 'POST', path: /^access-requests$/ },
  { method: 'GET', path: /^access-requests\/premium$/ },
  { method: 'POST', path: /^access-requests\/premium$/ },
  { method: 'GET', path: /^admin\/access-requests$/ },
  { method: 'POST', path: new RegExp(`^admin/access-requests/${UUID}$`) },
  // self-serve: a customer chooses a plan and is billed for it
  { method: 'GET', path: /^plans$/ },
  { method: 'POST', path: /^plans$/ },
  { method: 'GET', path: /^plans\/invoices$/ },
  { method: 'GET', path: /^admin\/invoices$/ },
  { method: 'POST', path: new RegExp(`^admin/invoices/${UUID}/paid$`) },
  // What the business is actually earning. Admin-only upstream; the service enforces the role.
  { method: 'GET', path: /^subscriptions\/revenue$/ },
  // The farmer agent. The hotline's own inbound webhook is not here on purpose: a carrier posts
  // to the API directly with a signature, and proxying it through the browser app would make a
  // public endpoint reachable with a session it does not need.
  { method: 'POST', path: /^agent\/ask$/ },
  { method: 'GET', path: /^admin\/hotline$/ },
  // commercial surfaces (admin only; the service enforces the role)
  { method: 'GET', path: /^billing\/pricing$/ },
  { method: 'GET', path: new RegExp(`^billing/pricing/${SLUG}$`) },
  { method: 'POST', path: new RegExp(`^billing/pricing/${SLUG}$`) },
  { method: 'GET', path: /^organizations$/ },
  { method: 'POST', path: /^organizations$/ },
  { method: 'GET', path: new RegExp(`^organizations/${UUID}/keys$`) },
  { method: 'POST', path: new RegExp(`^organizations/${UUID}/keys$`) },
  { method: 'DELETE', path: new RegExp(`^organizations/${UUID}/keys/${UUID}$`) },
  { method: 'GET', path: new RegExp(`^organizations/${UUID}/usage$`) },
]

export function isAllowed(method: Method, path: string): boolean {
  return ALLOWED.some((rule) => rule.method === method && rule.path.test(path))
}
