import { useEffect, useState } from 'react'
import { Bell, BellOff, BellRing } from 'lucide-react'
import { api, type PushSubscriptionPayload } from '../api'

type BrowserNotificationPermission = NotificationPermission | 'unsupported'

function decodeVapidPublicKey(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const decoded = window.atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(decoded.length))
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index)
  }
  return bytes
}

function subscriptionPayload(subscription: PushSubscription): PushSubscriptionPayload {
  const value = subscription.toJSON()
  if (!value.endpoint || !value.keys?.p256dh || !value.keys.auth) {
    throw new Error('The browser returned an incomplete push subscription.')
  }
  return {
    endpoint: value.endpoint,
    keys: {
      p256dh: value.keys.p256dh,
      auth: value.keys.auth,
    },
  }
}

async function getPushRegistration(): Promise<ServiceWorkerRegistration> {
  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) {
    throw new Error('The app service worker is not ready. Reload the portal and try again.')
  }
  return navigator.serviceWorker.ready
}

export function BrowserNotificationsButton({
  token,
  permission,
  onPermissionChange,
  notify,
}: {
  token: string
  permission: BrowserNotificationPermission
  onPermissionChange: (permission: NotificationPermission) => void
  notify: (message: string) => void
}) {
  const [pushEnabled, setPushEnabled] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    const syncExistingSubscription = async () => {
      if (
        !('Notification' in window) ||
        Notification.permission !== 'granted' ||
        !('serviceWorker' in navigator) ||
        !('PushManager' in window)
      ) {
        return
      }

      try {
        const registration = await getPushRegistration()
        const subscription = await registration.pushManager.getSubscription()
        if (!subscription) return
        await api.savePushSubscription(token, subscriptionPayload(subscription))
        if (active) setPushEnabled(true)
      } catch (error: unknown) {
        console.error('Could not restore the browser push subscription.', error)
        if (active) {
          notify(
            error instanceof Error
              ? `Could not connect push notifications: ${error.message}`
              : 'Could not connect push notifications to this device.',
          )
        }
      }
    }

    void syncExistingSubscription()
    return () => {
      active = false
    }
  }, [notify, token])

  const enablePush = async () => {
    if (
      permission === 'unsupported' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) {
      notify('This browser does not support background push notifications.')
      return
    }
    if (permission === 'denied') {
      notify('Notifications are blocked. Allow them in your browser site settings.')
      return
    }

    setBusy(true)
    try {
      const nextPermission =
        permission === 'granted'
          ? 'granted'
          : await Notification.requestPermission()
      onPermissionChange(nextPermission)
      if (nextPermission !== 'granted') {
        notify('Notifications were not enabled.')
        return
      }

      const { public_key: publicKey } = await api.pushVapidPublicKey(token)
      const registration = await getPushRegistration()
      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidPublicKey(publicKey),
        })
      }

      await api.savePushSubscription(token, subscriptionPayload(subscription))
      setPushEnabled(true)
      notify('Background order and reservation alerts are enabled on this device.')
    } catch (error: unknown) {
      console.error('Could not enable background push notifications.', error)
      notify(
        error instanceof Error
          ? `Could not enable push notifications: ${error.message}`
          : 'Could not enable push notifications. Check your browser settings.',
      )
    } finally {
      setBusy(false)
    }
  }

  const disablePush = async () => {
    setBusy(true)
    try {
      const registration = await getPushRegistration()
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await api.deletePushSubscription(token, subscription.endpoint)
        await subscription.unsubscribe()
      }
      setPushEnabled(false)
      notify('Background push alerts are disabled on this device.')
    } catch (error: unknown) {
      console.error('Could not disable background push notifications.', error)
      notify(
        error instanceof Error
          ? `Could not disable push notifications: ${error.message}`
          : 'Could not disable push notifications. Try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  const Icon =
    permission === 'denied'
      ? BellOff
      : pushEnabled
        ? BellRing
        : Bell
  const label =
    permission === 'denied'
      ? 'Alerts blocked'
      : pushEnabled
        ? 'Push alerts on'
        : permission === 'unsupported'
          ? 'Push unavailable'
          : 'Enable push'

  return (
    <button
      className="button button-outline button-small browser-notifications-button"
      type="button"
      onClick={() => void (pushEnabled ? disablePush() : enablePush())}
      disabled={busy}
      aria-label={label}
      title={
        permission === 'denied'
          ? 'Allow notifications in your browser site settings'
          : label
      }
    >
      <Icon size={15} />
      <span>{busy ? 'Please wait…' : label}</span>
    </button>
  )
}
