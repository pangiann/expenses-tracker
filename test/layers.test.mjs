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
    {
      filename: file('worker/household-durable-object/operations/read-operations.ts'),
      code: "import { buildMonthResponse } from '../operation-context.ts';",
    },
    { filename: file('shared/api/endpoints.ts'), code: "import * as z from 'zod/mini';" },
    {
      filename: file('test/anything.test.mjs'),
      code: "import { routeApiRequestToOperation } from '../worker/household-durable-object/api-request-router.ts';",
    },
  ],
  invalid: [
    {
      filename: file('shared/api/endpoints.ts'),
      code: "import { pendingEditsOutbox } from '../../web/scripts/api/pending-edits-outbox.ts';",
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
      filename: file('web/scripts/api/pending-edits-outbox.ts'),
      code: "import { QuickAdd } from '../features/quick-add/quick-add.ts';",
      errors: [{ messageId: 'layer' }],
    },
    {
      filename: file('web/scripts/components/entry-rows.ts'),
      code: "export { pendingEditsOutbox } from '../api/pending-edits-outbox.ts';",
      errors: [{ messageId: 'layer' }],
    },
    {
      filename: file('worker/household-durable-object/durable-object-month-repository.ts'),
      code: "import { LiveUpdateConnectionManager } from './live-update-connection-manager.ts';",
      errors: [{ messageId: 'layer' }],
    },
    {
      filename: file('worker/worker-entry-point.ts'),
      code: "import { routeApiRequestToOperation } from './household-durable-object/api-request-router.ts';",
      errors: [{ messageId: 'layer' }],
    },
    {
      filename: file('worker/household-durable-object/operations/add-operations.ts'),
      code: "import { routeApiRequestToOperation } from '../api-request-router.ts';",
      errors: [{ messageId: 'layer' }],
    },
  ],
});
