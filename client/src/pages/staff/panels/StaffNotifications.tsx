import NotificationPrefsForm from "@/components/NotificationPrefsForm";

export default function StaffNotifications({ enabled }: { enabled: boolean }) {
  return (
    <NotificationPrefsForm
      getUrl="/api/staff/notifications"
      putUrl="/api/staff/notifications"
      enabled={enabled}
      title="My notification settings (all bins)"
    />
  );
}
