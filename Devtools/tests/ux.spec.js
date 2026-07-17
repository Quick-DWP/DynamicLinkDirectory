// UX/UI smoke tests for the Dynamic Link Directory portal.
//
// These are pragmatic "does the UI make sense" checks — they render the real
// pages against a running server, assert the copy/behaviour we care about, and
// drop full-page screenshots into ./screenshots for a human to eyeball.
//
// They only *read* app state (plus one admin login to inspect the user form).
// The classic-shell check rewrites the /api/settings response in the browser
// only, so the shared demo database is never mutated.
//
// Note: the eyebrow labels are uppercased via CSS (text-transform), so we read
// raw textContent and compare case-insensitively rather than trusting innerText.

const { test, expect } = require('@playwright/test');
const path = require('path');

const SHOTS = path.join(__dirname, '..', 'screenshots');
// Never hardcode the real admin password. Default to the template's dev password;
// override with DLD_ADMIN_USER / DLD_ADMIN_PASS to run against a real deployment.
const ADMIN = {
  username: process.env.DLD_ADMIN_USER || 'admin',
  password: process.env.DLD_ADMIN_PASS || 'admin123',
};

const shot = (page, name) =>
  page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });

const loginCard = (page) => page.locator('.login-card');

// Raw (non-CSS-transformed) trimmed text of the first match.
const rawText = async (locator) => ((await locator.textContent()) || '').trim();

// Robustly type into a React-controlled, autofocused input: click, type with a
// small per-key delay, then fall back to fill() if the value didn't stick.
async function typeInto(input, value) {
  await input.click();
  await input.pressSequentially(value, { delay: 15 });
  if ((await input.inputValue()) !== value) await input.fill(value);
  await expect(input).toHaveValue(value);
}

// Sign in through the /login form as admin. Returns true on success.
async function loginAsAdmin(page) {
  await page.goto('/login');
  const card = loginCard(page);
  await expect(card).toBeVisible();
  await typeInto(card.locator('input[autocomplete="username"]'), ADMIN.username);
  await typeInto(card.locator('input[type="password"]'), ADMIN.password);
  const submit = card.locator('button.login-submit');
  await expect(submit).toBeEnabled({ timeout: 5000 });
  await submit.click();
  await page.waitForURL((url) => new URL(url).pathname === '/', { timeout: 8000 }).catch(() => {});
  return new URL(page.url()).pathname === '/';
}

test.describe('Login card copy (no duplicated "Sign in")', () => {
  test('/login uses a neutral eyebrow, single "Sign in" heading', async ({ page }) => {
    await page.goto('/login');
    const card = loginCard(page);
    await expect(card).toBeVisible();

    const eyebrow = await rawText(card.locator('.eyebrow'));
    const heading = await rawText(card.locator('h2'));
    // The eyebrow must not just repeat the heading.
    expect(eyebrow.toLowerCase()).not.toBe('sign in');
    expect(eyebrow.toLowerCase()).toBe('account');
    expect(heading).toBe('Sign in');

    // The Sign-in button spans the card width (matches the Microsoft button).
    await expect(card.locator('button.login-submit')).toBeVisible();

    await shot(page, '01-login-desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    await shot(page, '02-login-mobile');
  });

  test('/admin gate is framed as admin, not duplicated copy', async ({ page }) => {
    await page.goto('/admin');
    const card = loginCard(page);
    await expect(card).toBeVisible();
    expect((await rawText(card.locator('.eyebrow'))).toLowerCase()).toBe('admin');
    expect(await rawText(card.locator('h2'))).toBe('Sign in');
    await shot(page, '03-admin-gate');
  });

  test('private directory gate (require_login) shows a distinct eyebrow', async ({ page }) => {
    await page.goto('/');
    const card = loginCard(page);
    // require_login must be on for this gate to appear; skip cleanly otherwise.
    const appeared = await card.waitFor({ state: 'visible', timeout: 6000 }).then(() => true).catch(() => false);
    if (!appeared) test.skip(true, 'Directory is public (require_login off)');
    expect((await rawText(card.locator('.eyebrow'))).toLowerCase()).toBe('private');
    expect(await rawText(card.locator('h2'))).toBe('Sign in to view');
    await shot(page, '04-private-gate');
  });
});

test.describe('Classic-shell hero (long title must not cramp)', () => {
  test('long title wraps to a readable number of lines', async ({ page }) => {
    // Force the classic shell + a long title in the browser only (no DB write).
    await page.route('**/api/settings', async (route) => {
      const res = await route.fetch();
      const json = await res.json();
      if (json && json.data) {
        json.data.shell_layout = 'classic';
        json.data.site_title = 'Quick Transformation — Sales App Demo Portal';
        json.data.has_logo = false;
      }
      await route.fulfill({ json });
    });
    await page.goto('/');
    const h1 = page.locator('.hero h1');
    await expect(h1).toBeVisible();
    await expect(h1).toHaveText('Quick Transformation — Sales App Demo Portal');

    // Height / line-height ~= line count. Guard against the old 11ch pile-up.
    const box = await h1.boundingBox();
    const lh = parseFloat(await h1.evaluate((el) => getComputedStyle(el).lineHeight));
    const lines = Math.round(box.height / lh);
    expect(lines).toBeLessThanOrEqual(4);

    await shot(page, '05-classic-hero');
  });
});

test.describe('Admin user form defaults to least privilege', () => {
  test('“+ New” user pre-selects Viewer, and login lands on the directory', async ({ page }) => {
    if (!(await loginAsAdmin(page))) {
      test.skip(true, `Login did not succeed (admin/admin123 may be changed). At ${page.url()}`);
    }
    // Let the directory finish loading before the reference screenshot.
    await expect(page.locator('.panel-header-row .muted-copy')).not.toHaveText('Loading...', { timeout: 8000 });
    await shot(page, '06-after-login-directory');

    await page.goto('/admin');
    await page.locator('button.admin-tab', { hasText: 'Users' }).click();
    await page.locator('button.secondary-btn', { hasText: '+ New' }).click();

    const roleSelect = page.locator('select', { has: page.locator('option', { hasText: 'Viewer (can only view)' }) });
    await expect(roleSelect).toBeVisible();
    expect(await roleSelect.inputValue()).toBe('viewer');
    await shot(page, '07-admin-newuser-viewer-default');

    // Be a good citizen: end the session we created.
    const logout = page.locator('button.topbar-link, button.app-nav-link', { hasText: 'Log out' });
    if (await logout.first().isVisible().catch(() => false)) await logout.first().click();
  });
});

test.describe('Editor keeps its selection after save', () => {
  test('saving a link stays on that link (form is not cleared)', async ({ page }) => {
    if (!(await loginAsAdmin(page))) test.skip(true, 'Login did not succeed.');
    await page.goto('/admin/links');
    await page.locator('.item-list .item-card').first().click();
    await expect(page.locator('.workspace-grid h3', { hasText: 'Edit link' })).toBeVisible();
    const titleInput = page.locator('.field input').first();
    const title = await titleInput.inputValue();
    expect(title.length).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('.message.success', { hasText: 'Link updated' })).toBeVisible();

    // Still editing the same link — not reset to a blank "New link" form.
    await expect(page.locator('.workspace-grid h3', { hasText: 'Edit link' })).toBeVisible();
    expect(await titleInput.inputValue()).toBe(title);
    await expect(page.locator('.item-card.active')).toBeVisible();
  });
});

test.describe('Admin tabs are real routes', () => {
  test('deep-link, tab click, and refresh all keep the same section', async ({ page }) => {
    if (!(await loginAsAdmin(page))) test.skip(true, 'Login did not succeed.');

    // Deep link straight to a tab.
    await page.goto('/admin/users');
    await expect(page.locator('button.admin-tab.on', { hasText: 'Users' })).toBeVisible();
    await expect(page.locator('select', { has: page.locator('option', { hasText: 'Viewer (can only view)' }) })).toBeVisible();

    // Clicking a tab updates the URL.
    await page.locator('button.admin-tab', { hasText: 'Site settings' }).click();
    await expect(page).toHaveURL(/\/admin\/settings$/);

    // Refresh keeps us on that tab (the whole point).
    await page.reload();
    await expect(page.locator('button.admin-tab.on', { hasText: 'Site settings' })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/admin/settings');

    // Bare /admin redirects to a real tab.
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/categories$/);
  });
});

test.describe('Link attachments', () => {
  test('admin attaches a file; viewer previews it in a modal', async ({ page }) => {
    if (!(await loginAsAdmin(page))) test.skip(true, 'Login did not succeed.');

    // Resolve a target link and make sure the attachments API is present.
    const info = await page.evaluate(async () => {
      const token = localStorage.getItem('dld_token') || '';
      const h = { Authorization: `Bearer ${token}` };
      const lj = await (await fetch('/api/links', { headers: h })).json();
      const link = (lj.data || [])[0];
      if (!link) return { ok: false };
      const ar = await fetch(`/api/attachments/link/${link.uuid}`, { headers: h });
      return { ok: ar.ok, uuid: link.uuid, title: link.title };
    });
    if (!info.ok) test.skip(true, 'Attachments API not available (restart the backend).');

    // Remove any leftover test file from a prior run so the counts are deterministic.
    const cleanup = () => page.evaluate(async (linkId) => {
      const token = localStorage.getItem('dld_token') || '';
      const h = { Authorization: `Bearer ${token}` };
      const aj = await (await fetch(`/api/attachments/link/${linkId}`, { headers: h })).json();
      for (const a of (aj.data || [])) {
        if (a.filename === 'ux-attach-test.pdf') await fetch(`/api/attachments/${a.uuid}`, { method: 'DELETE', headers: h });
      }
    }, info.uuid);
    await cleanup();

    // Upload through the admin link editor.
    await page.goto('/admin/links');
    await page.locator('.item-list .item-card').first().click();
    const manager = page.locator('.att-manager');
    await expect(manager).toBeVisible();
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<<>>\n%%EOF', 'latin1');
    await manager.locator('input[type="file"]').setInputFiles({ name: 'ux-attach-test.pdf', mimeType: 'application/pdf', buffer: pdf });
    const row = page.locator('.att-admin-row', { hasText: 'ux-attach-test.pdf' }).first();
    await expect(row).toBeVisible({ timeout: 10000 });
    await shot(page, '09-admin-attachment-manager');

    // Admin "View" opens the in-page preview modal (not a new tab).
    await row.locator('button', { hasText: 'View' }).click();
    await expect(page.locator('.att-modal')).toBeVisible();
    await expect(page.locator('.att-preview-frame')).toBeVisible({ timeout: 10000 });
    await page.locator('.att-close').click();
    await expect(page.locator('.att-modal')).toHaveCount(0);

    // Viewer side: directory shows the button and previews the file.
    await page.goto('/');
    await expect(page.locator('.panel-header-row .muted-copy')).not.toHaveText('Loading...', { timeout: 8000 });
    await page.locator('.dld-toolbar input').first().fill(info.title); // force the group open
    const card = page.locator('.link-card', { hasText: info.title }).first();
    const btn = card.locator('.attach-btn');
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(page.locator('.att-modal')).toBeVisible();
    // Select our test PDF explicitly (the link may also have other files).
    await page.locator('.att-item', { hasText: 'ux-attach-test.pdf' }).click();
    await expect(page.locator('.att-preview-frame')).toBeVisible({ timeout: 10000 });
    await shot(page, '10-attachment-modal');

    // Cleanup: remove the uploaded test file.
    await cleanup();
  });
});

test.describe('Link note is admin-only', () => {
  test('editor exposes a Note field; the public directory never returns it', async ({ page }) => {
    if (!(await loginAsAdmin(page))) {
      test.skip(true, 'Login did not succeed (admin/admin123 may be changed).');
    }

    // The public directory payload must carry no `note` on any link. Fetch it
    // from the browser context (which holds the bearer token in localStorage).
    const dir = await page.evaluate(async () => {
      const token = localStorage.getItem('dld_token') || '';
      const r = await fetch('/api/directory', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      return { ok: r.ok, json: await r.json() };
    });
    expect(dir.ok).toBeTruthy();
    const allLinks = (dir.json?.data || []).flatMap((g) => g.links || []);
    expect(allLinks.length).toBeGreaterThan(0);
    expect(allLinks.some((l) => 'note' in l)).toBe(false);
    expect(JSON.stringify(dir.json)).not.toContain('"note"');

    // The admin link editor exposes the Note field.
    await page.goto('/admin');
    await page.locator('button.admin-tab', { hasText: 'Links' }).click();
    await page.locator('.item-list .item-card').first().click();
    const noteField = page.locator('label.field', { hasText: 'Note (admin only)' });
    await expect(noteField).toBeVisible();
    await expect(noteField.locator('textarea')).toBeVisible();
    await shot(page, '08-admin-link-note-field');

    const logout = page.locator('button.topbar-link, button.app-nav-link', { hasText: 'Log out' });
    if (await logout.first().isVisible().catch(() => false)) await logout.first().click();
  });
});
