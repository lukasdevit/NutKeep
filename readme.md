![ShareIT](https://healthchecks.io/b/2/85d9c28f-214f-4e72-8332-c72f1a741e73.svg)
# ShareIT

A self-hosted file sharing app you can run on your own server. Upload files, share them with a link, and manage everything from a clean ui.

Think of it as your personal Imgur or Dropbox — but you own the data.

<img src="docs/preview-v2.png" alt="Share screenshot" width="600" />

**Try the live demo:** [shareit.goletz.dev](https://shareit.goletz.dev)

---

## What can it do?

- **Drag & drop to upload** — small files go in one request, big files are automatically split into chunks. The only limit is your storage quota.
- **ShareX ready** — one click to generate a ShareX config, then screenshot and upload. Files up to ~100 MB work via ShareX; bigger files use the web app's chunked upload.
- **Public or private files** — keep stuff to yourself or share a link with anyone.
- **Auto-expiring uploads** — set files to disappear after a few days if you want.
- **Image gallery & file previews** — browse images in a lightbox, preview markdown and text files right in the browser.
- **Dark admin panel** — manage users, browse the database, check analytics, run backups. All from a clean Vercel-style UI that works great on mobile too.
- **Storage quotas** — each user gets a limit, and they can see how much they've used.

Under the hood it covers the basics you'd expect: JWT logins, rate limiting, automatic backups, and HTTPS via Caddy.

---

## How it's built

- **Backend:** Node + Fastify + TypeScript, SQLite for the database
- **Frontend:** Next.js + React + Tailwind CSS
- **Everything runs in Docker** with Caddy handling HTTPS

You can store files on the local disk or point it at Backblaze B2 if you want cloud storage.

---

## Getting started

```bash
git clone https://github.com/lukasdevit/ShareIT.git
cd ShareIT
cp .env.example .env   # fill in your secrets
docker compose -f docker-compose.dev.yml up -d
```

The frontend will be at [localhost:3001](http://localhost:3001), API at [localhost:3000](http://localhost:3000). Hot reload on both.

**Local dev without Docker:**
```bash
npm run dev          # backend only (localhost:3000)
npm run dev:all      # backend + frontend
npm test             # all tests
```

**Production:** `docker compose up -d`. Before deploying:
- Change the default admin password in `.env`
- Set `DOMAIN` to your real domain for HTTPS via Caddy
- Configure storage backend via Admin Panel → Storage (local or B2)

Push to `main` and CI/CD runs tests, tags a release, and deploys.

---

## License

MIT — do whatever you want with it.
