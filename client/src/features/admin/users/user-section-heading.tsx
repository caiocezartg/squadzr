/** A section's heading on a person's page: a mono caption over a Big Shoulders title. */
export function UserSectionHeading({
  id,
  caption,
  title,
}: {
  readonly id: string
  readonly caption: string
  readonly title: string
}) {
  return (
    <div className="mb-3.5">
      <p className="type-label text-muted">{caption}</p>
      <h3 id={id} className="font-display mt-1.5 text-2xl font-black uppercase">
        {title}
      </h3>
    </div>
  )
}
