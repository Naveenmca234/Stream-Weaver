# Contributing to StreamWeaver

Thank you for your interest in contributing to StreamWeaver! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Report security issues privately
- Follow the project's coding standards

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Create a feature branch: `git checkout -b feature/my-feature`
4. Run `npm install` to install dependencies
5. Set up environment variables (see SETUP.md)

## Development Workflow

### Before You Start

```bash
# Ensure you're on the latest code
git checkout develop
git pull origin develop

# Create a new feature branch
git checkout -b feature/my-feature
```

### Making Changes

1. Write code following the project's style guide
2. Add tests for new functionality
3. Update documentation if needed

### Code Quality

```bash
# Lint backend code
npm run lint --workspace=@streamweaver/backend

# Fix linting issues
npm run lint:fix --workspace=@streamweaver/backend

# Format code
npm run format --workspace=@streamweaver/backend

# Check formatting
npm run format:check --workspace=@streamweaver/backend

# Type checking
npm run tsc --workspace=@streamweaver/backend

# Run tests
npm test --workspace=@streamweaver/backend
```

### Commit Guidelines

- Use clear, descriptive commit messages
- Follow conventional commits: `type(scope): description`
  - Types: feat, fix, docs, style, refactor, perf, test, chore
  - Example: `feat(pipeline): add CSV column mapping`
- Keep commits atomic and logical

### Testing

```bash
# Run all tests
npm test --workspace=@streamweaver/backend

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- src/services/__tests__/schemaDetector.test.ts

# Generate coverage report
npm test -- --coverage
```

## Pull Request Process

1. Update your branch with latest develop: `git rebase origin/develop`
2. Push your changes: `git push origin feature/my-feature`
3. Open a Pull Request against the `develop` branch
4. Fill out the PR template completely
5. Wait for CI checks to pass
6. Request review from maintainers
7. Address feedback and re-request review

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking)
- [ ] New feature (non-breaking)
- [ ] Breaking change
- [ ] Documentation update

## Related Issues
Closes #(issue number)

## Testing
- [ ] Unit tests added
- [ ] Integration tests added
- [ ] Manual testing performed

## Checklist
- [ ] Code follows style guide
- [ ] Tests pass locally
- [ ] Documentation updated
- [ ] No new warnings generated
```

## Coding Standards

### TypeScript

- Use strict mode (enabled by default)
- Add explicit return types to functions
- Avoid `any` type; use proper typing
- Use meaningful variable names
- Keep functions focused and small

```typescript
// ❌ Avoid
async function process(data: any): any {
  // ...
}

// ✅ Do
async function processDataset(data: Dataset): Promise<ProcessResult> {
  // ...
}
```

### Error Handling

```typescript
// ✅ Use custom error classes
class ValidationError extends Error {
  constructor(message: string, public field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ✅ Log errors properly
logger.error('Failed to process dataset', {
  datasetId,
  error: err.message,
  stack: err.stack,
});
```

### Database

- Use transactions for multi-document operations
- Index frequently queried fields
- Use proper schema validation
- Add timestamps to documents

### API Routes

- RESTful design
- Consistent response format
- Proper HTTP status codes
- Input validation
- Rate limiting

```typescript
// Response format
{
  "success": true,
  "data": {...},
  "error": null
}
```

## Documentation

- Update README.md for significant changes
- Document new APIs
- Add JSDoc comments to complex functions
- Update SETUP.md if setup process changes

### JSDoc Example

```typescript
/**
 * Validates a dataset schema
 * @param schema - The schema to validate
 * @returns Validation result with errors if any
 * @throws {ValidationError} If schema is invalid
 * @example
 * const result = validateSchema({ fields: [...] });
 */
function validateSchema(schema: Schema): ValidationResult {
  // ...
}
```

## Performance Considerations

- Use streaming for large files
- Implement pagination for large datasets
- Cache frequently accessed data
- Use indexes on MongoDB queries
- Monitor memory usage
- Profile hot paths with benchmarks

## Security Guidelines

- Never commit secrets or API keys
- Use environment variables for configuration
- Validate all user input
- Sanitize data before storage
- Use parameterized queries
- Keep dependencies up to date

## Reporting Issues

### Bug Reports

Include:
- Clear description
- Steps to reproduce
- Expected vs actual behavior
- Environment info (Node version, OS, etc.)
- Screenshots/logs if applicable

### Feature Requests

Include:
- Use case description
- Why this feature is needed
- Proposed implementation (optional)
- Mockups/examples (if UI-related)

## Resources

- [Project Structure](./docs/architecture.md)
- [API Documentation](./docs/api-documentation.md)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Express.js Documentation](https://expressjs.com/)
- [MongoDB Documentation](https://docs.mongodb.com/)

## Questions?

- Check existing issues and discussions
- Ask in PR comments
- Contact maintainers
- Check documentation in `/docs` folder

Thank you for contributing! 🙏
