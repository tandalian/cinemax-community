const posterImages = [
  'photo-1489599849927-2ee91cede3ba',
  'photo-1440404653325-ab127d49abc1',
  'photo-1478720568477-152d9b164e26',
  'photo-1485846234645-a62644f84728',
  'photo-1517604931442-7e0c8ed2963c',
  'photo-1505685296765-3a2736de412f',
  'photo-1518676590629-3dcbd9c5a5c9',
  'photo-1500530855697-b586d89ba3ee',
  'photo-1519608487953-e999c86e7455',
  'photo-1536440136628-849c177e76a1',
  'photo-1514905552197-0610a4d8fd73',
  'photo-1518837695005-2083093ee35b',
]

const rows = [
  { direction: 'left', speed: '150s', delay: '-34s' },
  { direction: 'right', speed: '175s', delay: '-68s' },
  { direction: 'left', speed: '165s', delay: '-92s' },
  { direction: 'right', speed: '190s', delay: '-48s' },
] as const

function PosterRow({ direction, speed, delay }: (typeof rows)[number]) {
  const posters = [...posterImages, ...posterImages]

  return (
    <div className="poster-wall-row">
      <div
        className={`poster-wall-track poster-wall-${direction}`}
        style={{ animationDuration: speed, animationDelay: delay }}
      >
        {posters.map((photo, index) => (
          <div className="poster-wall-poster" key={`${photo}-${index}`}>
            <img
              src={`https://images.unsplash.com/${photo}?auto=format&fit=crop&w=480&h=720&q=85`}
              alt=""
              loading="lazy"
              onError={event => {
                event.currentTarget.style.display = 'none'
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function MoviePosterBackground() {
  return (
    <div className="movie-poster-background" aria-hidden="true">
      <div className="poster-wall">
        {rows.map(row => <PosterRow key={`${row.direction}-${row.speed}`} {...row} />)}
      </div>
      <div className="poster-wall-overlay" />
    </div>
  )
}
