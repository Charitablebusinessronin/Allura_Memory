export default function MemoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Force Allura theme immediately before hydration to prevent flash */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.setAttribute("data-theme-preset", "allura");`,
        }}
      />
      {children}
    </>
  )
}
