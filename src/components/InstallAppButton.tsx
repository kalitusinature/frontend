import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const INSTALL_PROMPT_DELAY = 30 * 60 * 1000
const DISMISSED_KEY = 'kalitusi-admin-install-prompt-dismissed'

function isAppInstalled(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && navigator.standalone === true)
  )
}

export function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [showInstallModal, setShowInstallModal] = useState(false)
  const [showIosInstructions, setShowIosInstructions] = useState(false)
  const [installError, setInstallError] = useState('')
  const [installed, setInstalled] = useState(isAppInstalled)
  const isIos =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }
    const handleInstalled = () => {
      setInstalled(true)
      setInstallPrompt(null)
      setShowInstallModal(false)
    }

    window.addEventListener('beforeinstallprompt', handleInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)

    let timer = 0
    if (!installed && !window.sessionStorage.getItem(DISMISSED_KEY)) {
      timer = window.setTimeout(() => setShowInstallModal(true), INSTALL_PROMPT_DELAY)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
      window.clearTimeout(timer)
    }
  }, [installed])

  const dismissModal = () => {
    window.sessionStorage.setItem(DISMISSED_KEY, 'true')
    setShowInstallModal(false)
  }

  const install = async () => {
    if (!installPrompt) {
      setShowIosInstructions(true)
      return
    }

    try {
      await installPrompt.prompt()
      const choice = await installPrompt.userChoice
      setInstallPrompt(null)
      if (choice.outcome === 'accepted') {
        setShowInstallModal(false)
        window.sessionStorage.setItem(DISMISSED_KEY, 'true')
      }
    } catch (error: unknown) {
      console.error('Could not start the app installation prompt.', error)
      setInstallError('The app could not be installed. Try your browser menu instead.')
    }
  }

  return (
    <>
      {(installPrompt || isIos) && (
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
      )}
      {showInstallModal && !installed && (
        <div className="modal-backdrop install-modal-backdrop">
          <section
            className="modal-card install-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-modal-title"
          >
            <button
              className="icon-button install-modal-close"
              aria-label="Close install prompt"
              onClick={dismissModal}
            >
              <X size={18} />
            </button>
            <span className="install-modal-icon" aria-hidden="true">
              <Download size={23} />
            </span>
            <span className="eyebrow">KALITUSI RESORT OPERATIONS</span>
            <h2 id="install-modal-title">Download an App Now</h2>
            <p>
              Add the admin portal to your device for quick access to incoming
              orders and reservation requests.
            </p>
            {isIos && (
              <p className="install-modal-instructions">
                In Safari, tap <strong>Share</strong>, then choose{' '}
                <strong>Add to Home Screen</strong>.
              </p>
            )}
            {!isIos && !installPrompt && (
              <p className="install-modal-instructions">
                Open your browser menu and choose <strong>Install app</strong> or{' '}
                <strong>Add to Home Screen</strong>.
              </p>
            )}
            {installError && <p className="form-error">{installError}</p>}
            <div className="install-modal-actions">
              {installPrompt && (
                <button className="button button-primary" onClick={() => void install()}>
                  <Download size={16} />
                  Install app
                </button>
              )}
              <button className="button button-outline" onClick={dismissModal}>
                Maybe later
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
