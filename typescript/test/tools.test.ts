import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  MockInstance,
} from 'vitest';
import { AdyenConfig } from '../src/configurations/configurations.js';
import { getActiveTools, toolGroups } from '../src/tools/tools';

describe('tools', () => {
  describe('getActiveTools', () => {
    const totalToolsCount = Object.values(toolGroups).flat().length;
    const createConfig = (
      overrides: Partial<AdyenConfig> = {},
    ): AdyenConfig => ({
      adyenApiKey: 'test-key',
      env: 'TEST',
      ...overrides,
    });

    describe('default behavior', () => {
      it('should return ALL tools when no filters are provided', () => {
        const config = createConfig({});
        const result = getActiveTools(config);

        expect(result.size).toBe(totalToolsCount);
      });

      it('should return ALL tools when filter arrays are empty', () => {
        const config = createConfig({
          includeApi: [],
          tools: [],
        });
        const result = getActiveTools(config);

        expect(result.size).toBe(totalToolsCount);
      });
    });

    describe('filtering by API Groups', () => {
      it('should return only tools from a specific API group (e.g., checkout)', () => {
        const config = createConfig({
          includeApi: ['checkout'],
        });
        const result = getActiveTools(config);

        const checkoutCount = toolGroups.checkout.length;
        expect(result.size).toBe(checkoutCount);

        const hasPaymentLink = Array.from(result).some(
          (t) => t.name === 'create_payment_links',
        );
        expect(hasPaymentLink).toBe(true);
      });

      it('should return union of tools from multiple API groups', () => {
        const config = createConfig({
          includeApi: ['checkout', 'configuration'],
        });
        const result = getActiveTools(config);

        const expectedCount =
          toolGroups.checkout.length + toolGroups.configuration.length;
        expect(result.size).toBe(expectedCount);
      });
    });

    describe('filtering by Tool Names', () => {
      it('should return specific tools when requested by name', () => {
        const config = createConfig({
          tools: ['create_payment_links', 'get_merchant_account'],
        });
        const result = getActiveTools(config);

        expect(result.size).toBe(2);

        const names = Array.from(result).map((t) => t.name);
        expect(names).toContain('create_payment_links');
        expect(names).toContain('get_merchant_account');
      });
    });

    describe('combined filtering & deduplication', () => {
      it('should handle non-overlapping combinations of API group and specific tools', () => {
        const config = createConfig({
          includeApi: ['configuration'],
          tools: ['list_merchant_accounts'],
        });
        const result = getActiveTools(config);

        const configCount = toolGroups.configuration.length;
        expect(result.size).toBe(configCount + 1);
      });

      it('should NOT duplicate tools if requested in both API group and specific tools', () => {
        // 'createPaymentLink' is INSIDE 'checkout' group
        const config = createConfig({
          includeApi: ['checkout'],
          tools: ['createPaymentLink'],
        });
        const result = getActiveTools(config);

        // Should be exactly size of checkout group, no duplicates
        expect(result.size).toBe(toolGroups.checkout.length);
      });
    });

    describe('error handling and logging', () => {
      let consoleSpy: MockInstance;

      beforeEach(() => {
        consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      });

      afterEach(() => {
        consoleSpy.mockRestore();
      });

      it('should log error for invalid API group names', () => {
        const config = createConfig({
          includeApi: ['invalidGroup', 'checkout'],
        });

        // Should still return checkout tools
        const result = getActiveTools(config);

        expect(result.size).toBe(toolGroups.checkout.length);
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringMatching(/API Group 'invalidGroup' not found/i),
        );
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringMatching(/Available API groups/i),
        );
      });

      it('should log error for invalid tool names', () => {
        const config = createConfig({
          tools: ['typoToolName', 'create_payment_links'],
        });

        const result = getActiveTools(config);

        expect(result.size).toBe(1); // Should still get createPaymentLink
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringMatching(/Tool 'typoToolName' not found/i),
        );
      });

      it('should throw Error if NO valid tools are selected (activeTools is empty)', () => {
        const config = createConfig({
          includeApi: ['invalidGroup'],
          tools: ['invalidTool'],
        });

        // The function is designed to throw if the final Set is empty
        expect(() => getActiveTools(config)).toThrow(
          /No valid tools were selected/i,
        );

        // Also verify the console errors were logged
        expect(consoleSpy).toHaveBeenCalledTimes(2);
      });
    });
  });
});
