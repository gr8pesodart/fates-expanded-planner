import { useRef, useState } from 'react'
import { shareUrl } from '../lib/share'
import { useActivePlan, usePlansStore } from '../state/plansStore'

function downloadJson(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function SettingsScreen() {
  const plan = useActivePlan()
  const planCount = usePlansStore((s) => s.plans.length)
  const createPlan = usePlansStore((s) => s.createPlan)
  const exportBundle = usePlansStore((s) => s.exportBundle)
  const importBundle = usePlansStore((s) => s.importBundle)
  const deleteAll = usePlansStore((s) => s.deleteAll)

  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleExport = () => {
    const stamp = new Date().toISOString().slice(0, 10)
    downloadJson(`fates-expanded-planner-${stamp}.json`, JSON.stringify(exportBundle(), null, 2))
    setMessage(`Exported ${planCount} plan${planCount === 1 ? '' : 's'}.`)
  }

  const handleImport = async (file: File | undefined) => {
    if (!file) return
    const text = await file.text()
    const result = importBundle(text)
    setMessage(
      'imported' in result
        ? `Imported ${result.imported} plan${result.imported === 1 ? '' : 's'}.`
        : `Import failed: ${result.error}`,
    )
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleShare = async () => {
    if (!plan) return
    const url = shareUrl(plan)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this plan link:', url)
    }
  }

  return (
    <>
      <section className="card">
        <h2>Saves</h2>
        <p className="hint">
          Plans auto-save to this device ({planCount} saved). Export a JSON backup any time — it is
          the only guaranteed way to keep plans if browser storage is cleared.
        </p>
        <div className="btnrow">
          <button type="button" className="btn btn--solid" onClick={handleExport}>
            Export backup
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            Import backup
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => createPlan()}>
            New plan
          </button>
          <button type="button" className="btn btn--danger" onClick={handleShare} disabled={!plan}>
            {copied ? 'Link copied' : 'Copy share link'}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => void handleImport(e.target.files?.[0])}
        />
        {message && (
          <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>
            {message}
          </p>
        )}
        <div className="btnrow" style={{ marginTop: 14 }}>
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => {
              if (window.confirm('Delete every saved plan on this device?')) {
                deleteAll()
                setMessage('All plans deleted.')
              }
            }}
          >
            Delete all plans
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Install on your phone</h2>
        <div className="prose">
          <p>
            The planner is a PWA: open it in a mobile browser and add it to your home screen for an
            app-like, offline-capable window.
          </p>
          <p>
            <b>iOS:</b> Safari → Share → Add to Home Screen. <b>Android:</b> Chrome → ⋮ → Install
            app. <b>Desktop:</b> use the install icon in the address bar.
          </p>
        </div>
      </section>

      <section className="card">
        <h2>About</h2>
        <div className="prose">
          <p>
            A planning tool for a modded Fire Emblem Fates run: expanded support rules from
            Unofficial Gay Fates, free renown/accessory mods, and pay data falls out of the installed
            build rather than vanilla assumptions.
          </p>
          <p>
            Support data is extracted from the UGF Paragon export in the local fe-fates build.
            Architecture follows the open-source Fates planners by Athnir and Marigold; game-data
            formats lean on thane98’s Paragon and mila tooling.
          </p>
          <p style={{ color: 'var(--ink-3)', fontSize: 12.5 }}>
            Fan-made. Fire Emblem Fates and all associated artwork and text are trademarks of their
            respective owners.
          </p>
        </div>
      </section>
    </>
  )
}
