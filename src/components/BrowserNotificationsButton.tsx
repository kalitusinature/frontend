import { Bell, BellOff, BellRing } from 'lucide-react'

type BrowserNotificationPermission = NotificationPermission | 'unsupported'

export function BrowserNotificationsButton({
  permission,
  onPermissionChange,
  notify,
}: {
  permission: BrowserNotificationPermission
  onPermissionChange: (permission: NotificationPermission) => void
  notify: (message: string) => void
}) {
  const enableNotifications = async () => {
    if (permission === 'unsupported') {
      notify('This browser does not support desktop notifications.')
      return
    }
    if (permission === 'denied') {
      notify('Notifications are blocked. Allow them in your browser site settings.')
      return
    }

    try {
      const nextPermission = await Notification.requestPermission()
      onPermissionChange(nextPermission)
      notify(
        nextPermission === 'granted'
          ? 'Order and reservation notifications are enabled.'
          : 'Notifications were not enabled.',
      )
    } catch (error: unknown) {
      console.error('Could not request browser notification permission.', error)
      notify('Could not enable browser notifications. Check your browser settings.')
    }
  }

  const Icon = permission === 'granted' ? BellRing : permission === 'denied' ? BellOff : Bell
  const label =
    permission === 'granted'
      ? 'Alerts on'
      : permission === 'denied'
        ? 'Alerts blocked'
        : permission === 'unsupported'
          ? 'Alerts unavailable'
          : 'Enable alerts'

  return (
    <button
      className="button button-outline button-small browser-notifications-button"
      type="button"
      onClick={() => void enableNotifications()}
      aria-label={label}
      title={
        permission === 'denied'
          ? 'Allow notifications in your browser site settings'
          : label
      }
    >
      <Icon size={15} />
      <span>{label}</span>
    </button>
  )
}
