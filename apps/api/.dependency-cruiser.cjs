/**
 * Règles d'architecture (docs/04-architecture/overview.md, docs/02-domain/bounded-contexts.md).
 * Exécution : `pnpm --filter api arch`.
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Pas de dépendance circulaire.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'domain-is-pure',
      severity: 'error',
      comment: 'Le domaine est du TypeScript pur : aucune dépendance npm ni module Node.',
      from: { path: '/domain/' },
      to: { dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-no-pkg', 'core'] },
    },
    {
      name: 'domain-depends-on-nothing-outer',
      severity: 'error',
      comment: 'Le domaine ne dépend ni de application, ni de infrastructure, ni de presentation.',
      from: { path: '/domain/' },
      to: { path: '/(application|infrastructure|presentation)/' },
    },
    {
      name: 'application-no-outer-layers',
      severity: 'error',
      comment: "L'application ne dépend que du domaine.",
      from: { path: '/application/' },
      to: { path: '/(infrastructure|presentation)/' },
    },
    {
      name: 'application-no-framework',
      severity: 'error',
      comment: "L'application n'importe ni Nest, ni TypeORM, ni un driver DB.",
      from: { path: '/application/' },
      to: { path: 'node_modules/(@nestjs|typeorm|pg|express|class-validator|class-transformer)/' },
    },
    {
      name: 'infrastructure-no-presentation',
      severity: 'error',
      from: { path: '/infrastructure/' },
      to: { path: '/presentation/' },
    },
    {
      name: 'presentation-no-infrastructure',
      severity: 'error',
      comment:
        "Controllers et subscriptions passent par l'application. Seuls les *.module.ts (composition root) câblent l'infrastructure.",
      from: { path: '/presentation/', pathNot: '\\.module\\.ts$' },
      to: { path: '/infrastructure/' },
    },
    {
      name: 'no-cross-context',
      severity: 'error',
      comment:
        "Un context n'importe que lui-même, shared, config et les contrats publiés d'un autre context.",
      from: { path: '^src/([^/]+)/', pathNot: '^src/(shared|config|migrations)/' },
      to: {
        path: '^src/[^/]+/',
        pathNot: ['^src/$1/', '^src/shared/', '^src/config/', '^src/[^/]+/contracts/'],
      },
    },
    {
      name: 'shared-no-context',
      severity: 'error',
      comment:
        'Le shared kernel ne dépend d’aucun bounded context (migrations et config sont transverses).',
      from: { path: '^src/shared/' },
      to: { path: '^src/', pathNot: '^src/(shared|config|migrations)/' },
    },
    {
      name: 'no-test-code-in-src',
      severity: 'error',
      from: { path: '^src/', pathNot: '\\.(spec|int-spec|e2e-spec)\\.ts$' },
      to: { path: '^test/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '\\.(spec|int-spec|e2e-spec)\\.ts$' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
    },
  },
};
