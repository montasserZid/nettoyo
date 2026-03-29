function DashboardShell({
  title,
  subtitle
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-[#F7F7F7] px-4 py-16">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-8 shadow-[0_24px_60px_rgba(17,24,39,0.08)]">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#4FC3F7]">Nettoyó</p>
        <h1 className="mt-4 text-3xl font-bold text-[#1A1A2E]">{title}</h1>
        <p className="mt-3 text-[#6B7280]">{subtitle}</p>
      </div>
    </div>
  );
}

export function CleanerDashboardPage() {
  return (
    <DashboardShell
      title="Cleaner dashboard"
      subtitle="This placeholder dashboard confirms the protected cleaner route is working."
    />
  );
}
