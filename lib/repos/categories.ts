/**
 * Category Repository — CRUD for categories and category groups.
 *
 * Part of the Repository Pattern.
 * All queries use Drizzle ORM query builder.
 */
import { eq, asc, max } from 'drizzle-orm';
import { categories, categoryGroups } from '../db/schema';
import type { DrizzleDB } from './client';

export function createCategoryFunctions(database: DrizzleDB) {

  async function getCategoryGroups() {
    return database.select().from(categoryGroups)
      .orderBy(asc(categoryGroups.sortOrder), asc(categoryGroups.name));
  }

  async function getCategories(groupId?: number) {
    if (groupId) {
      return database.select().from(categories)
        .where(eq(categories.categoryGroupId, groupId))
        .orderBy(asc(categories.sortOrder), asc(categories.name));
    }
    return getCategoriesWithGroups();
  }

  async function getCategoriesWithGroups() {
    return database.select({
      id: categories.id,
      categoryGroupId: categories.categoryGroupId,
      name: categories.name,
      sortOrder: categories.sortOrder,
      hidden: categories.hidden,
      linkedAccountId: categories.linkedAccountId,
      groupName: categoryGroups.name,
    })
      .from(categories)
      .innerJoin(categoryGroups, eq(categories.categoryGroupId, categoryGroups.id))
      .orderBy(asc(categoryGroups.sortOrder), asc(categories.sortOrder), asc(categories.name));
  }

  async function updateCategoryName(id: number, name: string) {
    return database.update(categories)
      .set({ name })
      .where(eq(categories.id, id));
  }

  async function updateCategoryGroupOrder(groups: { id: number, sort_order: number }[]) {
    return database.transaction(async (tx) => {
      for (const group of groups) {
        await tx.update(categoryGroups)
          .set({ sortOrder: group.sort_order })
          .where(eq(categoryGroups.id, group.id));
      }
    });
  }

  async function updateCategoryOrder(cats: { id: number, sort_order: number, category_group_id?: number }[]) {
    return database.transaction(async (tx) => {
      for (const cat of cats) {
        const updates: Partial<typeof categories.$inferInsert> = { sortOrder: cat.sort_order };
        if (cat.category_group_id !== undefined) {
          updates.categoryGroupId = cat.category_group_id;
        }
        await tx.update(categories)
          .set(updates)
          .where(eq(categories.id, cat.id));
      }
    });
  }

  async function createCategoryGroup(name: string) {
    const result = await database.select({ maxOrder: max(categoryGroups.sortOrder) })
      .from(categoryGroups);
    const newOrder = (result[0]?.maxOrder ?? 0) + 1;

    const rows = await database.insert(categoryGroups)
      .values({ name, sortOrder: newOrder })
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
