/**
 * Category Repository — CRUD for categories and category groups.
 *
 * Part of the Repository Pattern.
 * All queries use Drizzle ORM query builder.
 */
import { eq, asc, max, and, sql } from 'drizzle-orm';
import { categories, categoryGroups } from '../db/schema';
import type { DrizzleDB } from '../db/helpers';

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

  async function updateCategoryGroupOrder(budgetId: number, groups: { id: number; sortOrder: number }[]) {
    if (groups.length === 0) return;
    const ids = groups.map(g => g.id);
    const sortCases = sql.join(
      groups.map(g => sql`WHEN ${g.id} THEN ${g.sortOrder}::integer`),
      sql` `,
    );
    await database.execute(sql`
      UPDATE ${categoryGroups}
      SET sort_order = CASE id ${sortCases} END
      WHERE id IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})
        AND ${categoryGroups.budgetId} = ${budgetId}
    `);
  }

  async function updateCategoryOrder(budgetId: number, cats: { id: number; sortOrder: number; categoryGroupId?: number }[]) {
    if (cats.length === 0) return;
    const ids = cats.map(c => c.id);
    const sortCases = sql.join(
      cats.map(c => sql`WHEN ${c.id} THEN ${c.sortOrder}::integer`),
      sql` `,
    );
    const hasGroupUpdates = cats.some(c => c.categoryGroupId !== undefined);

    if (hasGroupUpdates) {
      // Build CASE for categoryGroupId — only update rows that have a new group
      const groupCases = sql.join(
        cats.map(c => c.categoryGroupId !== undefined
          ? sql`WHEN ${c.id} THEN ${c.categoryGroupId}::integer`
          : sql`WHEN ${c.id} THEN category_group_id`  // keep current value
        ),
        sql` `,
      );
      await database.execute(sql`
        UPDATE ${categories}
        SET sort_order = CASE id ${sortCases} END,
            category_group_id = CASE id ${groupCases} END
        WHERE id IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})
          AND ${categories.categoryGroupId} IN (
            SELECT ${categoryGroups.id} FROM ${categoryGroups} 
            WHERE ${categoryGroups.budgetId} = ${budgetId}
          )
      `);
    } else {
      await database.execute(sql`
        UPDATE ${categories}
        SET sort_order = CASE id ${sortCases} END
        WHERE id IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})
          AND ${categories.categoryGroupId} IN (
            SELECT ${categoryGroups.id} FROM ${categoryGroups} 
            WHERE ${categoryGroups.budgetId} = ${budgetId}
          )
      `);
    }
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
    // Get budgetId from the group to ensure consistency
    const groupRows = await database.select({ budgetId: categoryGroups.budgetId })
        .from(categoryGroups)
        .where(eq(categoryGroups.id, category.category_group_id));
    
    if (!groupRows[0]) {
        throw new Error(`Category group ${category.category_group_id} not found`);
    }
    const budgetId = groupRows[0].budgetId;

    const result = await database.select({ maxOrder: max(categories.sortOrder) })
      .from(categories)
      .where(eq(categories.categoryGroupId, category.category_group_id));
    const newOrder = (result[0]?.maxOrder ?? 0) + 1;

    const rows = await database.insert(categories)
      .values({
        budgetId,
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
