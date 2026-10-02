import { runMigrations } from './migrate'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

runMigrations(url)
  .then(() => {
    console.log('migrations applied')
    process.exit(0)
  })
  .catch((err: unknown) => {
    console.error(err)
    process.exit(1)
  })
