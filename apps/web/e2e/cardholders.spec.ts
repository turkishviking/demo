import { expect, type Page, test } from '@playwright/test';

/** Suffixe unique : la base est partagée entre les runs. */
const unique = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

async function registerPerson(page: Page, firstName: string, lastName: string, email: string) {
  await page.goto('/people/new');
  await page.getByLabel('Prénom', { exact: true }).fill(firstName);
  await page.getByLabel('Nom', { exact: true }).fill(lastName);
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: `${firstName} ${lastName}` }),
  ).toBeVisible();
  return page.url().split('/').at(-1)!;
}

async function createGroup(page: Page, name: string, maxMembers: number) {
  await page.goto('/groups/new');
  await page.getByLabel('Nom', { exact: true }).fill(name);
  await page.getByLabel('Capacité (membres)').fill(String(maxMembers));
  await page.getByRole('button', { name: 'Créer le groupe' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  return page.url();
}

async function addMember(page: Page, groupUrl: string, personId: string) {
  await page.goto(groupUrl);
  await page.getByLabel('Ajouter une personne').selectOption(personId);
  await page.getByRole('button', { name: 'Ajouter au groupe' }).click();
}

test('M1 demo — a person belongs to at most one group, a group has a capacity', async ({
  page,
}) => {
  const id = unique();
  const ada = await registerPerson(page, 'Ada', `Lovelace ${id}`, `ada.${id}@example.com`);
  const grace = await registerPerson(page, 'Grace', `Hopper ${id}`, `grace.${id}@example.com`);
  const duo = await createGroup(page, `Duo ${id}`, 1);

  // Ajout d'un membre
  await addMember(page, duo, ada);
  await expect(page.getByRole('main').getByRole('status')).toHaveText('Membre ajouté.');
  await expect(page.getByRole('link', { name: `Ada Lovelace ${id}` })).toBeVisible();
  await expect(page.getByText('1 / 1 membres')).toBeVisible();

  // US-CH-3 CA3 : groupe complet
  await addMember(page, duo, grace);
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Ce groupe est complet.');

  // US-CH-3 CA2 : une personne dans au plus un groupe
  const other = await createGroup(page, `Other ${id}`, 5);
  await addMember(page, other, ada);
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'fait déjà partie d’un groupe',
  );

  // Changer de groupe : retirer, puis ajouter
  await page.goto(duo);
  await page.getByRole('button', { name: `Retirer Ada Lovelace ${id}` }).click();
  await expect(page.getByText('0 / 1 membres')).toBeVisible();
  await addMember(page, other, ada);
  await expect(page.getByRole('main').getByRole('status')).toHaveText('Membre ajouté.');

  await page.goto(`/people/${ada}`);
  await expect(page.getByRole('link', { name: `Other ${id}` })).toBeVisible();
});

test('US-CH-2 — deactivating a person removes them from their group', async ({ page }) => {
  const id = unique();
  const alan = await registerPerson(page, 'Alan', `Turing ${id}`, `alan.${id}@example.com`);
  const team = await createGroup(page, `Team ${id}`, 3);
  await addMember(page, team, alan);
  await expect(page.getByRole('main').getByRole('status')).toHaveText('Membre ajouté.');

  await page.goto(`/people/${alan}`);
  await page.getByRole('button', { name: 'Désactiver la personne' }).click();
  await page.getByRole('button', { name: 'Confirmer la désactivation' }).click();

  await expect(page.getByText('Désactivée', { exact: true })).toBeVisible();
  await expect(page.getByText('Aucun groupe')).toBeVisible();
  await page.goto(team);
  await expect(page.getByText('0 / 3 membres')).toBeVisible();
});

test('US-CH-1 CA2 — an email already used is refused', async ({ page }) => {
  const id = unique();
  const email = `dup.${id}@example.com`;
  await registerPerson(page, 'First', `Person ${id}`, email);

  await page.goto('/people/new');
  await page.getByLabel('Prénom', { exact: true }).fill('Second');
  await page.getByLabel('Nom', { exact: true }).fill('Person');
  await page.getByLabel('Email').fill(email.toUpperCase());
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(page.getByRole('main').getByRole('alert')).toHaveText(
    'Cet email est déjà utilisé par une autre personne.',
  );
  await expect(page.getByLabel('Prénom', { exact: true })).toHaveValue('Second');
});

test('people can be searched from the URL (server-rendered filters)', async ({ page }) => {
  const id = unique();
  await registerPerson(page, 'Searchable', `Person ${id}`, `search.${id}@example.com`);
  await page.goto(`/people?q=${id}`);
  await expect(page.getByRole('searchbox').or(page.getByLabel('Recherche'))).toHaveValue(id);
  await expect(page.getByRole('link', { name: `Searchable Person ${id}` })).toBeVisible();
  await expect(page.getByRole('row')).toHaveCount(2); // en-tête + 1 résultat
});
