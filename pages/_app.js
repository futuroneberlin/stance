import { useEffect } from 'react'
import '../styles/globals.css'

export default function App({ Component, pageProps }) {
  useEffect(() => {
    const reloadOnce = () => {
      if (typeof window === 'undefined') return
      if (sessionStorage.getItem('stance:chunk-reload') === '1') return
      sessionStorage.setItem('stance:chunk-reload', '1')
      window.location.reload()
    }

    const onError = (event) => {
      const message = String(event?.message || event?.error?.message || '')
      const target = event?.target
      const src = String(target?.src || target?.href || '')
      const isChunkFailure = /ChunkLoadError|Loading chunk|Loading CSS chunk|CSS chunk \\d+ failed|failed to load resource/i.test(message)
      const isAsset404 = src.includes('/_next/static/') && (target?.tagName === 'SCRIPT' || target?.tagName === 'LINK')

      if (isChunkFailure || isAsset404) {
        event?.preventDefault?.()
        reloadOnce()
      }
    }

    window.addEventListener('error', onError, true)
    window.addEventListener('unhandledrejection', onError)

    return () => {
      window.removeEventListener('error', onError, true)
      window.removeEventListener('unhandledrejection', onError)
    }
  }, [])

  return (
    <>
      <svg style={{position: 'absolute', width: 0, height: 0}} aria-hidden="true" focusable="false">
        <defs>
          <filter id="concreteDisplace">
            <feTurbulence type="fractalNoise" baseFrequency="0.007" numOctaves="2" result="t" seed="2">
              <animate attributeName="baseFrequency" dur="12s" values="0.004;0.012;0.006;0.008" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="t" scale="6" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
      <Component {...pageProps} />
    </>
  )
}
