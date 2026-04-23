'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { useCurrentUser } from '@/lib/userContext';
import { getApiErrorMessage, readJsonSafely } from '@/lib/utils';

type Notification = {
  id: number;
  requestId: number;
  type: 'approved' | 'rejected' | 'queried';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export default function AccountPage() {
  const router = useRouter();
  const { user, isLoading } = useCurrentUser();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [openNotification, setOpenNotification] = useState<Notification | null>(null);

  async function loadNotifications() {
    setLoadingNotifications(true);
    try {
      const response = await fetch('/api/notifications?limit=30', { cache: 'no-store' });
      const payload = (await readJsonSafely(response)) as { notifications?: Notification[]; unreadCount?: number } | null;
      if (!response.ok) {
        throw new Error(getApiErrorMessage(response, payload, 'Failed to load notifications'));
      }
      setNotifications(Array.isArray(payload?.notifications) ? payload.notifications : []);
      setUnreadCount(Number(payload?.unreadCount ?? 0));
    } catch {
      // Keep account page functional if notification service is unavailable.
    } finally {
      setLoadingNotifications(false);
    }
  }

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user]);

  async function markAllRead() {
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark-all-read' }),
      });
      if (!response.ok) {
        const payload = await readJsonSafely(response);
        throw new Error(getApiErrorMessage(response, payload, 'Failed to mark notifications as read'));
      }
      await loadNotifications();
      window.dispatchEvent(new Event('notificationsUpdated'));
    } catch {
      // Ignore and keep existing list rendered.
    }
  }

  async function handleOpenNotification(notification: Notification) {
    setOpenNotification(notification);
    if (!notification.isRead) {
      try {
        await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'mark-read', notificationId: notification.id }),
        });
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
        window.dispatchEvent(new Event('notificationsUpdated'));
      } catch {
        // Non-critical — notification still opens.
      }
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });

      const payload = await readJsonSafely(response);
      if (!response.ok) {
        throw new Error(getApiErrorMessage(response, payload, 'Failed to update password'));
      }

      setMessage('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="container py-10">
        <div className="mx-auto max-w-xl">
          <p className="text-sm uppercase tracking-widest text-sky-600">Account</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">My Account</h1>
          <p className="mt-1 text-sm text-slate-500">Manage your notifications and account settings.</p>

          <Card className="mt-6 p-6" title="Notifications" description="Approval updates for your requests.">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-slate-600">Unread: <span className="font-semibold text-slate-900">{unreadCount}</span></p>
              <Button type="button" variant="secondary" onClick={markAllRead} disabled={unreadCount === 0}>Mark all as read</Button>
            </div>

            {loadingNotifications ? <p className="text-sm text-slate-500">Loading notifications...</p> : null}

            <div className="space-y-3">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => handleOpenNotification(notification)}
                  className={`block w-full text-left rounded-xl border px-4 py-3 transition-shadow hover:shadow-sm ${
                    notification.isRead ? 'border-slate-200 bg-white' : 'border-sky-200 bg-sky-50/40'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                    <span className="text-xs text-slate-500 whitespace-nowrap">{new Date(notification.createdAt).toLocaleString('en-IE')}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{notification.message}</p>
                </button>
              ))}
              {!loadingNotifications && notifications.length === 0 ? (
                <p className="text-sm text-slate-500">No notifications yet.</p>
              ) : null}
            </div>
          </Card>

          <Card className="mt-6 p-6" title="Reset Password" description="Update your own portal password securely.">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block text-sm text-slate-700">
                Current password
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3"
                />
              </label>

              <label className="block text-sm text-slate-700">
                New password
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3"
                />
              </label>

              <label className="block text-sm text-slate-700">
                Confirm new password
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3"
                />
              </label>

              {error ? <p className="text-sm text-rose-600">{error}</p> : null}
              {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

              <Button type="submit" disabled={submitting}>
                {submitting ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          </Card>


        </div>
      </main>

      {openNotification && (
        <Dialog
          open={!!openNotification}
          title={openNotification.title}
          onClose={() => setOpenNotification(null)}
        >
          <div className="space-y-4 text-sm">
            <p className="text-slate-700">{openNotification.message}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">{new Date(openNotification.createdAt).toLocaleString('en-IE')}</span>
              <Button variant="secondary" type="button" onClick={() => setOpenNotification(null)}>Close</Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
