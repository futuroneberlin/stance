import '../styles/globals.css'

export default function App({ Component, pageProps }) {
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
