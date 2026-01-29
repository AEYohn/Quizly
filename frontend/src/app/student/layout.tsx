// Force dynamic rendering for all student pages (they use Clerk auth)
export const dynamic = "force-dynamic";

export default function StudentLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
