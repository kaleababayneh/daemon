import './globals.css'

export const metadata = {
  title: 'Smart Account Recovery',
  description: 'Recover your smart wallet account',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}