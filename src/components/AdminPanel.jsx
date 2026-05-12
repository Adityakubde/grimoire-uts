import { formatFullDate } from '../utils.js';

export default function AdminPanel({
  activities,
  currentUserId,
  loading,
  onRefresh,
  onSoftDeleteUser,
  users,
}) {
  return (
    <main className="flex-1 overflow-y-auto custom-scrollbar px-4 lg:px-10 py-6 lg:py-8">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-8">
        <div>
          <h2 className="text-4xl lg:text-6xl font-serif tracking-tight text-on-surface">Admin Panel</h2>
          <p className="font-sans text-sm text-[#b8b0c4] mt-2">
            Manage user accounts and review recent account activity.
          </p>
        </div>
        <button
          className="border border-outline-variant/40 text-primary px-4 py-3 font-sans text-xs font-bold uppercase tracking-widest hover:bg-surface-container transition-colors"
          onClick={onRefresh}
          type="button"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-3" aria-hidden="true">
          <div className="skeleton-block h-16 w-full"></div>
          <div className="skeleton-block h-16 w-full"></div>
          <div className="skeleton-block h-16 w-full"></div>
        </div>
      ) : (
        <div className="space-y-8">
          <section className="bg-[#111118] border border-outline-variant/10 overflow-x-auto">
            <div className="p-5 border-b border-outline-variant/10">
              <h3 className="font-serif text-3xl">Users</h3>
            </div>
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-surface-container-lowest text-[#b8b0c4] font-sans text-[10px] uppercase tracking-widest">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last Login</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {users.map((user) => {
                  const isCurrentUser = user.id === currentUserId;
                  const canDelete = user.isActive && !isCurrentUser;
                  const actionLabel = isCurrentUser ? 'Current' : user.isActive ? 'Delete' : 'Deleted';

                  return (
                    <tr key={user.id} className="font-sans text-sm">
                      <td className="px-4 py-4 text-on-surface">{user.displayName}</td>
                      <td className="px-4 py-4 text-[#b8b0c4]">{user.email}</td>
                      <td className="px-4 py-4">
                        <span className="inline-flex border border-outline-variant/30 px-3 py-2 text-primary text-[10px] uppercase tracking-widest">
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={user.isActive ? 'text-green-300' : 'text-error'}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-[#b8b0c4]">{formatFullDate(user.lastLoginAt)}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            className={`border px-3 py-2 text-[10px] uppercase tracking-widest ${
                              canDelete
                                ? 'border-error/30 text-error hover:bg-error/10'
                                : 'border-outline-variant/20 text-outline-variant cursor-not-allowed opacity-60'
                            }`}
                            disabled={!canDelete}
                            onClick={() => onSoftDeleteUser(user)}
                            type="button"
                          >
                            {actionLabel}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="bg-[#111118] border border-outline-variant/10 overflow-x-auto">
            <div className="p-5 border-b border-outline-variant/10">
              <h3 className="font-serif text-3xl">Recent Activity</h3>
            </div>
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-surface-container-lowest text-[#b8b0c4] font-sans text-[10px] uppercase tracking-widest">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {activities.map((activity) => (
                  <tr key={activity.id} className="font-sans text-sm">
                    <td className="px-4 py-4 text-[#b8b0c4]">{formatFullDate(activity.createdAt)}</td>
                    <td className="px-4 py-4 text-on-surface">
                      {activity.profile?.displayName || 'Unknown'}
                    </td>
                    <td className="px-4 py-4 text-primary uppercase text-xs tracking-widest">
                      {activity.action}
                    </td>
                    <td className="px-4 py-4 text-[#b8b0c4]">{activity.entityType}</td>
                    <td className="px-4 py-4 text-on-surface">{activity.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </main>
  );
}
