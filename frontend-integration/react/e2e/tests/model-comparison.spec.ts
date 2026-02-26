import { test, expect } from 'playwright';
import { AppPage } from '../pages/app.page';
import { getCurrentModel, getModelSlug } from '../helpers/model-config';

const modelSlug = getModelSlug(getCurrentModel());

const testCases = [
  {
    name: 'semantic-direct',
    action: 'chip' as const,
    label: 'Counties with 40%+ higher education',
  },
  {
    name: 'mcp-demographics',
    action: 'chip' as const,
    label: 'MCP Demographics around Times Square',
  },
  {
    name: 'fly-to-ny',
    action: 'message' as const,
    text: 'Fly to New York',
  },
];

test.describe(`Model Comparison [${modelSlug}]`, () => {
  for (const tc of testCases) {
    test(`${tc.name}`, async ({ page }) => {
      const app = new AppPage(page);
      await app.setup();

      // Execute the prompt
      if (tc.action === 'chip') {
        await app.chat.clickChip(tc.label!);
      } else {
        await app.chat.sendMessage(tc.text!);
      }

      // Wait for response (MCP workflows can take >90s)
      await app.chat.waitForThinking();
      await app.chat.waitForResponseComplete({ timeout: 110_000 });

      // Verify no errors
      expect(await app.chat.hasError()).toBe(false);

      // Wait for map stability
      await app.map.waitForStable();

      // Capture screenshot with model-specific name
      await app.map.captureScreenshot(`${tc.name}.png`);
    });
  }
});
