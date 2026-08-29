// Suspense fallback for the lazy routes. Kept out of main.jsx so the entry file
// defines no components of its own.
export default function PageLoader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'system-ui' }}>
      <div style={{
        width: 40, height: 40, border: '3px solid #e5e7eb', borderTopColor: '#0D7A5F',
        borderRadius: '50%', animation: 'spin 0.8s linear infinite'
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
