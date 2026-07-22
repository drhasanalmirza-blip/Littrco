import NotificationPrefsForm from "@/components/NotificationPrefsForm";

export default function PartnerNotifications({ shopId, enabled }: { shopId: number; enabled: boolean }) {
  return (
    <div className="space-y-4">
      <NotificationPrefsForm
        getUrl={`/api/partner/shops/${shopId}/notifications`}
        putUrl={`/api/partner/shops/${shopId}/notifications`}
        enabled={enabled && shopId > 0}
        title="Notifications for this shop"
      />
    </div>
  );
}
