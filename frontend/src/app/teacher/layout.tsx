import { Sidebar } from "~/components/ui/Sidebar";

export default function TeacherLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-gray-950">
            <Sidebar />
            <main className="ml-64 min-h-screen">{children}</main>
        </div>
    );
}
