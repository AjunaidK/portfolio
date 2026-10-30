# Junaid Khan — Personal Website + Admin Panel

A personal profile website that you edit yourself from a private admin panel. No code changes are needed to update your content.

- **Website** (`/`): bold gradient design, dark/light toggle and an animated neural-network hero (signals flow through the layers, and neurons light up under the cursor). Your name animates in and role words rotate beneath it. Below that: a skills marquee, About with animated stat counters, Selected work, Experience timeline, Toolkit, GitHub, Testimonials, Writing and Contact (with a form).
- **Command palette:** press **Ctrl/⌘ + K** on any page to jump to sections, projects and posts, switch theme, copy your email or download your CV.
- **Project case studies** (`/projects/<name>`): key numbers, problem, approach, results, a gallery with lightbox, and a link to the next project.
- **Blog posts** (`/blog/<name>`): write posts in the admin panel, or link to articles hosted elsewhere, such as LinkedIn.
- **GitHub section:** add your username in the admin panel. The server fetches your profile, top languages and latest repos from GitHub, caching them for 1 hour. Optionally set a `GITHUB_TOKEN` environment variable for higher rate limits.
- **Admin panel** (`/admin`): Dashboard (visits and messages), Profile & homepage, Projects, Experience, Skills, Writing, Messages inbox, Account.

Built with Node.js, Express, SQLite and plain HTML/CSS/JS. It is set up the same way as the Car Shine project.

---

## Run it locally (VS Code)

```bash
npm install
npm start
```
- Website: http://localhost:3000
- Admin: http://localhost:3000/admin. First login is **admin / changeme123**; change it in **Account**.

## What you can change in the admin panel

| Section | What you can do |
|---|---|
| Dashboard | Visits today, visits over the last 7 days, a 14-day chart, top pages, latest messages. Your own visits aren't counted while you're logged in. |
| Profile & homepage | Name, rotating role words, neural-network labels, stat counters, two gradient colours, default theme, GitHub username, status badge, open-to-work dot, headline (wrap words in `*stars*` to colour them), intro line, the right-hand panel (animated readout / photo / none), profile photo, About text, section headings, email, phone, LinkedIn, GitHub, **CV upload (PDF)**, contact form on/off, accent colour, browser title, search description. |
| Projects | Add, edit, delete, reorder (▲▼) or hide projects. Card fields: title, dates, category, featured flag, summary, tags, cover image, link. Case-study fields: key numbers, problem, approach, results, gallery. |
| Testimonials | Quotes with name, role, photo and link. The section stays hidden until you add one. |
| Experience & education | Add jobs, degrees or volunteering with dates and bullet points. |
| Skills | Skill groups, each with a comma-separated list of skills. |
| Writing | Blog posts in Markdown, with a cover image. Or set an external link, and the post card opens it directly. |
| Messages | Everything sent through the contact form. Reply by email, mark as read or unread, delete. |
| Account | Change your username and password. |

### Markdown cheat sheet (About text and posts)
```
# Heading        **bold**      *italic*      `code`
- bullet list    1. numbered   > quote       [link text](https://…)
![image](/uploads/…)           ```  code block  ```
```
To put an image inside a post, upload it as the cover (or in any image field) and copy its `/uploads/…` address.

## Add a new field later
All editable content is defined in **`schema.js`**. Add a field there, and the admin form and server validation pick it up automatically. To show it on the site, render it in `public/js/site.js`.

## Put it online
It uses the same hosting setup as Car Shine. It needs a host with **persistent storage**, because the database and uploads are saved to disk.

- **Free:** an Oracle Cloud Always Free VM with pm2 and Caddy. Follow the same steps as the Car Shine guide, using this repository instead.
- **Paid, easiest:** Railway or Render with a volume mounted at `/data`, and these variables set: `DATA_DIR=/data/db` and `UPLOAD_DIR=/data/uploads`.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | 3000 | Port |
| `ADMIN_USER` / `ADMIN_PASSWORD` | admin / changeme123 | First-run login only |
| `DATA_DIR` | ./data | Database location |
| `UPLOAD_DIR` | ./uploads | Uploaded images and CV |
| `JWT_SECRET` | auto-generated | Signs login cookies |

**Backups:** copy `data/` and `uploads/`.

## Security built in
- Hashed passwords (bcrypt) and an httpOnly login cookie.
- Limits on login attempts, contact-form messages and view tracking, plus a hidden honeypot field that catches spam bots.
- All content is escaped before it's displayed, and links are restricted to `http(s)`, `mailto` and site paths.
- Uploads accept only images and PDFs, up to 10 MB.

## Files
```
server.js        routes, API, auth, uploads
db.js            SQLite tables, first-run content
schema.js        every editable field + first-run content from LinkedIn
public/index.html, post.html, css/site.css, js/common.js, js/site.js   website
public/admin/    admin panel
```
