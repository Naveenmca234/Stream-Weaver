import ivm from 'isolated-vm';

export interface SandboxResult {
  success: boolean;
  value?: any;
  error?: string;
  executionTimeMs: number;
  timedOut: boolean;
}

export class SandboxService {
  static validateSyntax(code: string): { valid: boolean; error?: string } {
    try {
      const isolate = new ivm.Isolate({ memoryLimit: 8 });
      isolate.compileScriptSync(code);
      isolate.dispose();
      return { valid: true };
    } catch (err: unknown) {
      return { valid: false, error: (err as Error).message };
    }
  }

  static async execute(
    code: string,
    value: any,
    record: any,
    type: 'transform' | 'validate' = 'transform',
    timeoutMs: number = 50
  ): Promise<SandboxResult> {
    const startTime = Date.now();
    let isolate: ivm.Isolate | null = null;
    
    try {
      isolate = new ivm.Isolate({ memoryLimit: 8 });
      const context = isolate.createContextSync();
      const jail = context.global;

      jail.setSync('global', jail.derefInto());
      jail.setSync('value', new ivm.ExternalCopy(value).copyInto());
      jail.setSync('record', new ivm.ExternalCopy(record).copyInto());

      const script = isolate.compileScriptSync(`
        (function() {
          ${code}
          
          if (typeof processRow === 'function') {
            return processRow(value, record);
          }
          return undefined;
        })()
      `);

      const result = await script.run(context, { timeout: timeoutMs, copy: true });

      return {
        success: true,
        value: result,
        executionTimeMs: Date.now() - startTime,
        timedOut: false,
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        success: false,
        error: error.message,
        executionTimeMs: Date.now() - startTime,
        timedOut: error.message.includes('timeout'),
      };
    } finally {
      if (isolate) {
        isolate.dispose();
      }
    }
  }
}
