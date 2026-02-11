/**
 * Standalone layout for /api-docs — no sidebar, no auth required.
 */
export default function ApiDocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
