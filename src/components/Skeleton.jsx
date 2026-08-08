import './Skeleton.css'

/**
 * Shared loading placeholders.
 *
 * Pages used to define their own `.skeleton-line` and their own
 * `@keyframes shimmer` in page CSS. Because those rules were global and CSS
 * chunks persist across SPA navigation, whichever page loaded last won — so a
 * skeleton's animation depended on how you got to the page. Everything here is
 * namespaced `hs-skeleton-*` so it cannot collide.
 */

export function SkeletonLine({ width, height, className = '' }) {
  return (
    <div
      className={`hs-skeleton hs-skeleton-line ${className}`}
      style={{ width, height }}
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="hs-skeleton-card">
      <div className="hs-skeleton hs-skeleton-img" />
      <div className="hs-skeleton-card-body">
        <SkeletonLine />
        <SkeletonLine width="60%" />
        <SkeletonLine width="40%" />
      </div>
    </div>
  )
}

export function SkeletonPanel({ lines = 3 }) {
  return (
    <div className="hs-skeleton-panel">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} width={i === lines - 1 ? '55%' : '100%'} />
      ))}
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="hs-skeleton-row">
      <div className="hs-skeleton hs-skeleton-avatar" />
      <div className="hs-skeleton-row-body">
        <SkeletonLine width="70%" />
        <SkeletonLine width="45%" />
      </div>
    </div>
  )
}

/** Repeats a skeleton n times — saves an inline Array.from at each call site. */
export function SkeletonList(props) {
  const count = props.count ?? 3
  const Item = props.as || SkeletonRow
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Item key={i} />
      ))}
    </>
  )
}

export default SkeletonCard
