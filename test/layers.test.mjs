import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';

import layers from '../eslint/layers.mjs';

// RuleTester reports through the test framework's describe/it.
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });
const file = (relativePath) => `${process.cwd()}/${relativePath}`;

ruleTester.run('layers', layers.rules.layers, {
  valid: [
    {
      filename: file('web/scripts/features/quick-add/quick-add.ts'),
      code: "import { addExpense } from '../../api/expenses-api.ts';",
    },
    {
      filename: file('web/scripts/features/month-navigation/month-navigation.ts'),
      code: "import { AddMonthDialog } from './add-month-dialog.ts';",
    },
    {
      filename: file('web/scripts/pages/month-page.ts'),
      code: "import { QuickAdd } from '../features/quick-add/quick-add.ts';",
    },
    { filename: file('worker/household/handlers/months.ts'), code: "import { monthResponse } from '../household.ts';" },
    { filename: file('shared/api/endpoints.ts'), code: "import * as z from 'zod/mini';" },
    { filename: file('test/anything.test.mjs'), code: "import { routeRequest } from '../worker/household/router.ts';" },
  ],
  invalid: [
    {
      filename: file('shared/api/endpoints.ts'),
      code: "import { outbox } from '../../web/scripts/api/outbox.ts';",
      errors: [{ messageId: 'layer' }],
    },
    {
      filename: file('shared/month/month-record.ts'),
      code: "import { DurableObject } from 'cloudflare:workers';",
      errors: [{ messageId: 'package' }],
    },
    {
      filename: file('web/scripts/features/backup/backup-buttons.ts'),
      code: "import { CategoryCards } from '../categories/category-cards.ts';",
      errors: [{ messageId: 'layer' }],
    },
    {
      filename: file('web/scripts/api/outbox.ts'),
      code: "import { QuickAdd } from '../features/quick-add/quick-add.ts';",
      errors: [{ messageId: 'layer' }],
    },
    {
      filename: file('web/scripts/components/entry-rows.ts'),
      code: "export { outbox } from '../api/outbox.ts';",
      errors: [{ messageId: 'layer' }],
    },
    {
      filename: file('worker/household/month-repository.ts'),
      code: "import { Broadcaster } from './broadcaster.ts';",
      errors: [{ messageId: 'layer' }],
    },
    {
      filename: file('worker/index.ts'),
      code: "import { routeRequest } from './household/router.ts';",
      errors: [{ messageId: 'layer' }],
    },
  ],
});
