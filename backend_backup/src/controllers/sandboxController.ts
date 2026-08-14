import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { SandboxService } from '../sandbox/SandboxService';

export async function executeTransform(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { code, value, record } = req.body;

    if (!code) {
      res.status(400).json({ error: 'Code is required' });
      return;
    }

    // First validate syntax
    const syntaxCheck = SandboxService.validateSyntax(code);
    if (!syntaxCheck.valid) {
      res.json({
        success: false,
        syntaxValid: false,
        error: syntaxCheck.error,
        executionTimeMs: 0,
        timedOut: false,
      });
      return;
    }

    const result = await SandboxService.execute(
      code,
      value,
      record || {},
      'transform'
    );

    res.json({
      syntaxValid: true,
      ...result,
    });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
}

export async function validateCode(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { code } = req.body;
    const result = SandboxService.validateSyntax(code);
    res.json(result);
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
}
