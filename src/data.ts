export type Movie = {
  id: string
  title: string
  description: string
  genre: string
  year: number
  duration: string
  poster: string
  backdrop: string
  rating: number
  downloads: number
  featured?: boolean
}

export const demoMovies: Movie[] = [
  {
    id: '1',
    title: 'Neon Horizon',
    description: 'A courier crosses the last untouched city to deliver a message that could change the future.',
    genre: 'Sci-Fi',
    year: 2026,
    duration: '2h 08m',
    poster: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=700&q=85',
    backdrop: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1600&q=90',
    rating: 8.7,
    downloads: 1842,
    featured: true,
  },
  {
    id: '2',
    title: 'The Last Light',
    description: 'When the northern sky goes dark, a reclusive astronomer discovers a signal beneath the ice.',
    genre: 'Drama',
    year: 2025,
    duration: '1h 54m',
    poster: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=700&q=85',
    backdrop: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1600&q=90',
    rating: 8.2,
    downloads: 1231,
  },
  {
    id: '3',
    title: 'Signal Zero',
    description: 'An encrypted broadcast pulls four strangers into a race against a system that knows every move.',
    genre: 'Thriller',
    year: 2026,
    duration: '2h 16m',
    poster: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=700&q=85',
    backdrop: 'https://images.unsplash.com/photo-1517976547714-720226b864c1?auto=format&fit=crop&w=1600&q=90',
    rating: 7.9,
    downloads: 988,
  },
  {
    id: '4',
    title: 'Wild Current',
    description: 'A coastal expedition becomes a battle for survival when the ocean reveals its oldest secret.',
    genre: 'Adventure',
    year: 2024,
    duration: '1h 48m',
    poster: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=700&q=85',
    backdrop: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1600&q=90',
    rating: 8.4,
    downloads: 1567,
  },
  {
    id: '5',
    title: 'Midnight Protocol',
    description: 'One analyst has sixty minutes to stop a breach that is already rewriting the world.',
    genre: 'Action',
    year: 2025,
    duration: '2h 02m',
    poster: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=700&q=85',
    backdrop: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1600&q=90',
    rating: 8.0,
    downloads: 1104,
  },
]
