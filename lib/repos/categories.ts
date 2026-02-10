/**
 * Category Repository — CRUD for categories and category groups.
 *
 * Part of the Repository Pattern.
 * All queries use Drizzle ORM query builder.
 */
import { eq, asc, max, and, sql } from 'drizzle-orm';
import { categories, categoryGroups } from '../db/schema';
import type { DrizzleDB } from './client';

export interface Category {
  id: number;
  budgetId: number;
  categoryGroupId: number;
  name: string;
  sortOrder: number;
  hidden: boolean;
  linkedAccountId: number | null;
  groupName?: string;
}

export function createCategoryFunctions(database: DrizzleDB) {

  async function getCategoryGroups(budgetId: number) {
    return database.select().from(categoryGroups)
      .where(eq(categoryGroups.budgetId, budgetId))
      .orderBy(asc(categoryGroups.sortOrder), asc(categoryGroups.name));
  }

  async function getCategories(budgetId: number, groupId?: number) : Promise<Category[]> {
    if (groupId) {
      return database.select({
        id: categories.id,
        budgetId: categoryGroups.budgetId,
        categoryGroupId: categories.categoryGroupId,
        name: categories.name,
        sortOrder: categories.sortOrder,
        hidden: categories.hidden,
        linkedAccountId: categories.linkedAccountId,
      })
        .from(categories)
        .innerJoin(categoryGroups, eq(categories.categoryGroupId, categoryGroups.id))
        .where(and(eq(categories.categoryGroupId, groupId), eq(categoryGroups.budgetId, budgetId)))
        .orderBy(asc(categories.sortOrder), asc(categories.name));
    }
    return getCategoriesWithGroups(budgetId);
  }

  async function getCategoriesWithGroups(budgetId: number) : Promise<Category[]> {
    return database.select({
      id: categories.id,
      budgetId: categoryGroups.budgetId,
      categoryGroupId: categories.categoryGroupId,
      name: categories.name,
      sortOrder: categories.sortOrder,
      hidden: categories.hidden,
      linkedAccountId: categories.linkedAccountId,
      groupName: categoryGroups.name,
    })
      .from(categories)
      .innerJoin(categoryGroups, eq(categories.categoryGroupId, categoryGroups.id))
      .where(eq(categoryGroups.budgetId, budgetId))
      .orderBy(asc(categoryGroups.sortOrder), asc(categories.sortOrder), asc(categories.name));
  }

  async function updateCategoryName(id: number, name: string) {
    return database.update(categories)
      .set({ name })
      .where(eq(categories.id, id));
  }

  async function updateCategoryGroupOrder(budgetId: number, groups: { id: number, sort_order: number }[]) {
    return database.transaction(async (tx) => {
      for (const group of groups) {
        await tx.update(categoryGroups)
          .set({ sortOrder: group.sort_order })
          .where(and(eq(categoryGroups.id, group.id), eq(categoryGroups.budgetId, budgetId)));
      }
    });
  }

  async function updateCategoryOrder(budgetId: number, cats: { id: number, sort_order: number, category_group_id?: number }[]) {
    return database.transaction(async (tx) => {
      for (const cat of cats) {
        const updates: Partial<typeof categories.$inferInsert> = { sortOrder: cat.sort_order };
        if (cat.category_group_id !== undefined) {
          updates.categoryGroupId = cat.category_group_id;
        }
        await tx.update(categories)
          .set(updates)
          .where(and(
            eq(categories.id, cat.id),
            sql`${categories.categoryGroupId} IN (SELECT ${categoryGroups.id} FROM ${categoryGroups} WHERE ${categoryGroups.budgetId} = ${budgetId})`
          ));
      }
    });
  }

  async function createCategoryGroup(name: string, budgetId?: number) {
    const result = await database.select({ maxOrder: max(categoryGroups.sortOrder) })
      .from(categoryGroups);
    const newOrder = (result[0]?.maxOrder ?? 0) + 1;

    const rows = await database.insert(categoryGroups)
      .values({ 
        name, 
        sortOrder: newOrder,
        budgetId: budgetId as number,
      })
      .returning();
    return rows[0];
  }

  async function createCategory(category: { name: string; category_group_id: number; linked_account_id?: number }) {
    const result = await database.select({ maxOrder: max(categories.sortOrder) })
      .from(categories)
      .where(eq(categories.categoryGroupId, category.category_group_id));
    const newOrder = (result[0]?.maxOrder ?? 0) + 1;

    const rows = await database.insert(categories)
      .values({
        name: category.name,
        categoryGroupId: category.category_group_id,
        sortOrder: newOrder,
        linkedAccountId: category.linked_account_id ?? null,
      })
      .returning();
    return rows[0];
  }

  return {
    getCategoryGroups,
    getCategories,
    getCategoriesWithGroups,
    updateCategoryName,
    updateCategoryGroupOrder,
    updateCategoryOrder,
    createCategoryGroup,
    createCategory,
  };
}
