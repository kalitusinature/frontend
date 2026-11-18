import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [showIosInstructions, setShowIosInstructions] = useState(false)
  const isIos =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }
    const handleInstalled = () => setInstallPrompt(null)

    window.addEventListener('beforeinstallprompt', handleInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  const install = async () => {
    if (!installPrompt) {
      setShowIosInstructions((visible) => !visible)
      return
    }
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  if (!installPrompt && !isIos) return null

  return (
    <div className="install-app">
      <button className="button button-outline button-small" onClick={() => void install()}>
        <Download size={15} />
        Install app
      </button>
      {isIos && showIosInstructions && (
        <span className="install-instructions" role="status">
          In Safari, tap Share, then choose Add to Home Screen.
        </span>
      )}
    </div>
  )
}
