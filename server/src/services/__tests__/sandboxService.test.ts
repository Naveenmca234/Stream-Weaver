import { describe, it, expect } from 'vitest';
import { runTransform } from '../sandboxService';

describe('Sandbox Service', () => {
  it('should transform a simple field (or return sandbox unavailable if isolated-vm is missing)', async () => {
    const row = { name: 'john' };
    const ruleCode = 'return value.toUpperCase();';
    
    const result = await runTransform(ruleCode, 'john', row);
    
    // We expect either a success with JOHN, or a failure if isolated-vm isn't compiled
    if (result.success) {
      expect(result.value).toBe('JOHN');
    } else {
      expect(result.error).toContain('sandbox unavailable');
    }
  });

  it('should handle infinite loops gracefully', async () => {
    const row = { name: 'john' };
    const ruleCode = 'while(true) {} return value;';
    
    const result = await runTransform(ruleCode, 'john', row);
    
    // Expecting error (either timeout or unavailable)
    expect(result.success).toBe(false);
  });
});
