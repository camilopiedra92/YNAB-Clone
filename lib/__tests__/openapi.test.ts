/**
 * OpenAPI Spec Generation Tests
 *
 * Verifies that the OpenAPI document is generated correctly from the registry,
 * contains all expected endpoints, and produces a valid OpenAPI 3.1 structure.
 */
import { describe, it, expect } from 'vitest';
import { getOpenAPIDocument } from '../openapi/generator';

// Use `any` for deep OpenAPI object traversal in tests — strict typing
// isn't practical for testing the generated spec structure.
/* eslint-disable @typescript-eslint/no-explicit-any */

describe('OpenAPI Document Generation', () => {
  // Generate the document once for all tests
  const doc = getOpenAPIDocument() as any;

  it('generates a valid OpenAPI 3.1 document', () => {
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info.title).toBe('YNAB Clone API');
    expect(doc.info.version).toBe('1.0.0');
  });

  it('includes all expected tags', () => {
    const tagNames = doc.tags?.map((t: any) => t.name) ?? [];
    expect(tagNames).toContain('Auth');
    expect(tagNames).toContain('User');
    expect(tagNames).toContain('Budgets');
    expect(tagNames).toContain('Accounts');
    expect(tagNames).toContain('Budget Planning');
    expect(tagNames).toContain('Transactions');
    expect(tagNames).toContain('Categories');
    expect(tagNames).toContain('Payees');
    expect(tagNames).toContain('Sharing');
    expect(tagNames).toContain('Data Import');
  });

  it('registers all 17+ API paths', () => {
    const paths = Object.keys(doc.paths ?? {});
    expect(paths.length).toBeGreaterThanOrEqual(15);

    // Verify critical paths exist
    const expectedPaths = [
      '/api/auth/register',
      '/api/user/profile',
      '/api/user/password',
      '/api/budgets',
      '/api/budgets/{budgetId}',
      '/api/budgets/{budgetId}/accounts',
      '/api/budgets/{budgetId}/accounts/{id}',
      '/api/budgets/{budgetId}/accounts/{id}/reconciliation-info',
      '/api/budgets/{budgetId}/budget',
      '/api/budgets/{budgetId}/transactions',
      '/api/budgets/{budgetId}/categories',
      '/api/budgets/{budgetId}/category-groups',
      '/api/budgets/{budgetId}/categories/reorder',
      '/api/budgets/{budgetId}/payees',
      '/api/budgets/{budgetId}/shares',
      '/api/budgets/{budgetId}/shares/{shareId}',
      '/api/budgets/{budgetId}/import',
    ];

    for (const path of expectedPaths) {
      expect(paths, `Missing path: ${path}`).toContain(path);
    }
  });

  it('includes security scheme', () => {
    const securitySchemes = doc.components?.securitySchemes;
    expect(securitySchemes).toBeDefined();
    expect(securitySchemes?.BearerAuth).toBeDefined();
    expect(securitySchemes?.BearerAuth?.type).toBe('http');
    expect(securitySchemes?.BearerAuth?.scheme).toBe('bearer');
  });

  it('includes registered component schemas', () => {
    const schemaNames = Object.keys(doc.components?.schemas ?? {});

    // Response DTOs
    expect(schemaNames).toContain('Account');
    expect(schemaNames).toContain('Transaction');
    expect(schemaNames).toContain('BudgetItem');
    expect(schemaNames).toContain('BudgetResponse');
    expect(schemaNames).toContain('Category');
    expect(schemaNames).toContain('ShareInfo');
    expect(schemaNames).toContain('ReconciliationInfo');
    expect(schemaNames).toContain('UserProfile');

    // Common
    expect(schemaNames).toContain('ErrorResponse');
    expect(schemaNames).toContain('SuccessResponse');
  });

  it('defines correct methods for transaction routes', () => {
    const txPath = doc.paths?.['/api/budgets/{budgetId}/transactions'];
    expect(txPath).toBeDefined();
    expect(txPath?.get).toBeDefined();
    expect(txPath?.post).toBeDefined();
    expect(txPath?.put).toBeDefined();
    expect(txPath?.delete).toBeDefined();
    expect(txPath?.patch).toBeDefined();
  });

  it('defines correct methods for budget CRUD', () => {
    const budgetPath = doc.paths?.['/api/budgets/{budgetId}'];
    expect(budgetPath).toBeDefined();
    expect(budgetPath?.get).toBeDefined();
    expect(budgetPath?.patch).toBeDefined();
    expect(budgetPath?.delete).toBeDefined();
  });

  it('budget planning GET has month query parameter', () => {
    const budgetGet = doc.paths?.['/api/budgets/{budgetId}/budget']?.get;
    expect(budgetGet).toBeDefined();
    const params = budgetGet?.parameters ?? [];
    const monthParam = params.find(
      (p: any) => p.name === 'month' && p.in === 'query'
    );
    expect(monthParam).toBeDefined();
  });

  it('import route uses multipart/form-data', () => {
    const importPost = doc.paths?.['/api/budgets/{budgetId}/import']?.post;
    expect(importPost).toBeDefined();
    const contentTypes = Object.keys(importPost?.requestBody?.content ?? {});
    expect(contentTypes).toContain('multipart/form-data');
  });

  it('all authenticated endpoints have security defined', () => {
    // Register is public — no security
    const authRegister = doc.paths?.['/api/auth/register']?.post;
    expect(authRegister?.security).toBeUndefined();

    // Profile GET is authenticated
    const profileGet = doc.paths?.['/api/user/profile']?.get;
    expect(profileGet?.security).toBeDefined();
    expect(profileGet?.security).toEqual([{ BearerAuth: [] }]);

    // Budgets list is authenticated
    const budgetsList = doc.paths?.['/api/budgets']?.get;
    expect(budgetsList?.security).toBeDefined();
  });

  it('error response schema has expected structure', () => {
    const errorSchema = doc.components?.schemas?.ErrorResponse;
    expect(errorSchema).toBeDefined();
    expect(errorSchema?.properties?.error).toBeDefined();
    expect(errorSchema?.properties?.details).toBeDefined();
  });
});
