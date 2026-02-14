import { redirect } from 'next/navigation';

/**
 * Root page — redirects to the budget list.
 *
 * The app has no standalone dashboard; users must select a budget first.
 * The per-budget dashboard lives at /budgets/[budgetId]/dashboard.
 */
export default function Home() {
  redirect('/budgets');
}
