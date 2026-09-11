const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export const IconMail = (props) => (
  <svg {...base} {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="M3.5 7l8.5 6 8.5-6" />
  </svg>
)

export const IconLock = (props) => (
  <svg {...base} {...props}>
    <rect x="4" y="11" width="16" height="9" rx="2.5" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
)

export const IconPhone = (props) => (
  <svg {...base} {...props}>
    <path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.9 21 3 13.1 3 3.9c0-.6.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.3 1L6.6 10.8z" />
  </svg>
)

export const IconUser = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" />
  </svg>
)

export const IconEye = (props) => (
  <svg {...base} {...props}>
    <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

export const IconEyeOff = (props) => (
  <svg {...base} {...props}>
    <path d="M3 3l18 18" />
    <path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c7 0 10.5 7 10.5 7a13.5 13.5 0 0 1-3.1 4.1M6.6 6.6C3.6 8.5 1.5 12 1.5 12s3.5 7 10.5 7a10.7 10.7 0 0 0 4.4-.9" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </svg>
)

export const IconStore = (props) => (
  <svg {...base} {...props}>
    <path d="M3 9l1.5-5h15L21 9" />
    <path d="M3 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0" />
    <path d="M5 9v10h14V9" />
    <path d="M9 19v-6h6v6" />
  </svg>
)

export const IconBike = (props) => (
  <svg {...base} {...props}>
    <circle cx="5.5" cy="17.5" r="3.5" />
    <circle cx="18.5" cy="17.5" r="3.5" />
    <path d="M5.5 17.5L10 8h4l3 4.5h3M10 8l2 4.5" />
  </svg>
)

export const IconCheck = (props) => (
  <svg {...base} strokeWidth={2.4} {...props}>
    <path d="M5 13l4 4L19 7" />
  </svg>
)

export const IconChevron = (props) => (
  <svg {...base} {...props}>
    <path d="M9 18l6-6-6-6" />
  </svg>
)

export const IconGoogle = (props) => (
  <svg viewBox="0 0 48 48" width="18" height="18" {...props}>
    <path
      fill="#FFC107"
      d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
    />
    <path
      fill="#FF3D00"
      d="M6.3 14.7l6.6 4.8C14.5 16 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4c-7.4 0-13.8 4.1-17.1 10.1z"
    />
    <path
      fill="#4CAF50"
      d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6C29.6 35 26.9 36 24 36c-5.3 0-9.7-3-11.5-7.4l-6.6 5.1C9.9 40 16.4 44 24 44z"
    />
    <path
      fill="#1976D2"
      d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.1-3.1 5.6-5.6 7.3l6.6 5.6C39.9 38 44 32.5 44 24c0-1.3-.1-2.7-.4-3.5z"
    />
  </svg>
)

export const IconFacebook = (props) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="#1877F2" {...props}>
    <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z" />
  </svg>
)

export const Logomark = (props) => (
  <svg viewBox="0 0 40 40" width="34" height="34" {...props}>
    <defs>
      <linearGradient id="logomarkGradient" x1="0" y1="0" x2="40" y2="40">
        <stop offset="0" stopColor="#FF4D6D" />
        <stop offset="1" stopColor="#FF8A3D" />
      </linearGradient>
    </defs>
    <rect width="40" height="40" rx="12" fill="url(#logomarkGradient)" />
    <path d="M12 14h16M20 14v14M15 28h10" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
)
