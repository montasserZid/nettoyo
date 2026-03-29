import { useAuth } from '../context/AuthContext';

function DashboardShell({
  title,
  subtitle
}: {
  title: string;
  subtitle: string;
}) {
  const { profile } = useAuth();

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-[#F7F7F7] px-4 py-16">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-8 shadow-[0_24px_60px_rgba(17,24,39,0.08)]">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#4FC3F7]">Nettoyó</p>
        <h1 className="mt-4 text-3xl font-bold text-[#1A1A2E]">{title}</h1>
        <p className="mt-3 text-[#6B7280]">{subtitle}</p>
        <div className="mt-8 rounded-2xl bg-[#F7F7F7] p-6">
          <p className="text-sm text-[#6B7280]">Signed in as</p>
          <p className="mt-2 text-lg font-semibold text-[#1A1A2E]">
            {profile?.first_name || profile?.email || 'User'}
          </p>
          <p className="mt-1 text-sm text-[#6B7280]">{profile?.role}</p>
        </div>
      </div>
    </div>
  );
}

export function ClientDashboardPage() {
  return (
    <DashboardShell
      title="Client dashboard"
      subtitle="This placeholder dashboard confirms the protected client route is working."
    />
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
