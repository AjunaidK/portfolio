// Single source of truth for what the admin panel can edit.
// The server validates against this, and the admin panel builds its forms from it.
//
// Field types: text, textarea, markdown, lines, tags, image, images, file, bool, select, date, number, color

const SETTINGS = [
  { group: 'Hero', fields: [
    { key: 'name', label: 'Your name', type: 'text', default: 'Junaid Khan' },
    { key: 'roles', label: 'Rotating role words', type: 'tags', default: 'Data Scientist, ML Engineer, Software Engineer, Computer Vision', hint: 'Comma separated — they cycle under your name' },
    { key: 'status_text', label: 'Status badge', type: 'text', default: 'Open to Data Scientist & ML roles · UK' },
    { key: 'open_to_work', label: 'Show green "available" dot', type: 'bool', default: '1' },
    { key: 'lede', label: 'Intro line', type: 'textarea', default: 'London-based data scientist with **two years shipping production software** and an **MSc in Data Science**. I build models that see, and the systems that put them to work.', hint: 'Use **double stars** for bold' },
    { key: 'net_inputs', label: 'Neural network input labels', type: 'tags', default: 'pixels, landmarks, signals, data', hint: 'Left side of the hero animation' },
    { key: 'net_outputs', label: 'Neural network output labels', type: 'tags', default: 'insight, models, products', hint: 'Right side of the hero animation' },
    { key: 'profile_photo', label: 'Profile photo', type: 'image', default: '', hint: 'Shown in the About section' },
  ]},
  { group: 'About', fields: [
    { key: 'about_title', label: 'About heading', type: 'text', default: 'Engineer first. Now a data scientist.' },
    { key: 'about_body', label: 'About text', type: 'markdown', default:
      'I spent two years building production web applications at AsTechSolutions in Peshawar, working across the whole development lifecycle from requirements to release. That taught me to ship things that work and keep working.\n\n' +
      'I then moved to London for an MSc in Data Science at LSBU, where my dissertation became a real-time computer vision app that reads engagement from a webcam. Alongside that I run an independent e-commerce business, where I use analytics to test designs and grow an audience.\n\n' +
      "I'm looking for Data Scientist, Machine Learning Engineer or Data/AI Engineer roles in the UK: on-site, hybrid or remote." },
    { key: 'stats', label: 'Stat counters', type: 'lines', default: '2|Years building production software\n6|Engagement states my model detects\n4|Projects shipped end to end', hint: 'One per line as  number|label  (number can include + or %)' },
  ]},
  { group: 'Section headings', fields: [
    { key: 'work_title', label: 'Projects heading', type: 'text', default: 'Selected work' },
    { key: 'exp_title', label: 'Experience heading', type: 'text', default: 'The path so far' },
    { key: 'skills_title', label: 'Skills heading', type: 'text', default: 'Toolkit' },
    { key: 'github_title', label: 'GitHub heading', type: 'text', default: 'On GitHub' },
    { key: 'testimonials_title', label: 'Testimonials heading', type: 'text', default: 'Kind words' },
    { key: 'writing_title', label: 'Writing heading', type: 'text', default: 'Writing' },
  ]},
  { group: 'Contact & links', fields: [
    { key: 'contact_title', label: 'Contact heading', type: 'text', default: "Let's build something intelligent." },
    { key: 'email', label: 'Email (shown publicly)', type: 'text', default: 'arbabjunaidkhan6@gmail.com' },
    { key: 'phone', label: 'Phone (leave blank to hide)', type: 'text', default: '' },
    { key: 'location', label: 'Location', type: 'text', default: 'London, United Kingdom' },
    { key: 'linkedin', label: 'LinkedIn URL', type: 'text', default: 'https://www.linkedin.com/in/arbabjunaidkhan/' },
    { key: 'github_username', label: 'GitHub username', type: 'text', default: '', hint: 'Turns on the GitHub section (repos, languages, stars)' },
    { key: 'cv_file', label: 'CV (PDF)', type: 'file', default: '', hint: 'Adds "Download CV" buttons' },
    { key: 'contact_form', label: 'Show contact form', type: 'bool', default: '1' },
  ]},
  { group: 'Look & SEO', fields: [
    { key: 'accent_color', label: 'Gradient colour 1', type: 'color', default: '#7c5cff' },
    { key: 'accent2_color', label: 'Gradient colour 2', type: 'color', default: '#21d4fd' },
    { key: 'default_theme', label: 'Default theme', type: 'select', options: ['dark', 'light'], default: 'dark', hint: 'Visitors can still switch' },
    { key: 'site_title', label: 'Browser tab title', type: 'text', default: 'Junaid Khan — Data Scientist & ML Engineer' },
    { key: 'seo_description', label: 'Search engine description', type: 'textarea', default: 'Junaid Khan — Data Scientist with a software engineering background, based in London. MSc Data Science, LSBU. Computer vision, machine learning, full-stack.' },
  ]},
];

const COLLECTIONS = {
  projects: {
    label: 'Projects', singular: 'project', titleField: 'title', subField: 'period', slugged: true,
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'slug', label: 'URL name', type: 'text', hint: 'Auto-made from the title if blank' },
      { key: 'period', label: 'When', type: 'text', hint: 'e.g. Jun – Sep 2026' },
      { key: 'category', label: 'Category', type: 'text', hint: 'e.g. Computer vision, IoT, Full-stack' },
      { key: 'featured', label: 'Featured (big card)', type: 'bool' },
      { key: 'summary', label: 'Short description (card)', type: 'textarea' },
      { key: 'tags', label: 'Tech tags', type: 'tags', hint: 'Comma separated' },
      { key: 'image', label: 'Cover image', type: 'image' },
      { key: 'link_url', label: 'Link URL', type: 'text', hint: 'GitHub, demo, paper…' },
      { key: 'link_label', label: 'Link text', type: 'text', hint: 'e.g. View on GitHub' },
      { key: 'metrics', label: 'Key numbers (case study)', type: 'lines', hint: 'One per line as  value|label' },
      { key: 'problem', label: 'Case study: the problem', type: 'markdown' },
      { key: 'approach', label: 'Case study: the approach', type: 'markdown' },
      { key: 'results', label: 'Case study: results & lessons', type: 'markdown' },
      { key: 'gallery', label: 'Case study gallery', type: 'images', hint: 'Screenshots, diagrams, photos' },
    ],
  },
  experience: {
    label: 'Experience & education', singular: 'entry', titleField: 'title', subField: 'org',
    fields: [
      { key: 'title', label: 'Role or degree', type: 'text', required: true },
      { key: 'org', label: 'Organisation · place', type: 'text' },
      { key: 'period', label: 'When', type: 'text', hint: 'e.g. Sep 2022 – Nov 2024' },
      { key: 'kind', label: 'Type', type: 'select', options: ['work', 'education', 'volunteering'] },
      { key: 'bullets', label: 'Bullet points', type: 'lines', hint: 'One per line' },
    ],
  },
  skills: {
    label: 'Skills', singular: 'skill group', titleField: 'group', subField: 'items',
    fields: [
      { key: 'group', label: 'Group name', type: 'text', required: true },
      { key: 'items', label: 'Skills', type: 'tags', hint: 'Comma separated' },
    ],
  },
  testimonials: {
    label: 'Testimonials', singular: 'testimonial', titleField: 'name', subField: 'role',
    fields: [
      { key: 'quote', label: 'Quote', type: 'textarea', required: true },
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'role', label: 'Role · organisation', type: 'text', hint: 'e.g. Lecturer, LSBU' },
      { key: 'photo', label: 'Photo', type: 'image' },
      { key: 'link', label: 'Link (e.g. their LinkedIn)', type: 'text' },
    ],
  },
  posts: {
    label: 'Writing', singular: 'post', titleField: 'title', subField: 'date', slugged: true,
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'slug', label: 'URL name', type: 'text', hint: 'Auto-made from the title if blank' },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'read_minutes', label: 'Minutes to read', type: 'number' },
      { key: 'summary', label: 'One-line summary', type: 'textarea' },
      { key: 'external_url', label: 'External link (optional)', type: 'text', hint: 'If set and the post has no text, the card opens this link (e.g. your LinkedIn article)' },
      { key: 'cover', label: 'Cover image', type: 'image' },
      { key: 'body', label: 'Post text', type: 'markdown', hint: 'Markdown: # Heading, **bold**, *italic*, - lists, [link](url), ```code```' },
    ],
  },
};

// First-run content, taken from the LinkedIn profile
const SEED = {
  projects: [
    { title: 'Real-time emotion & engagement detection', slug: 'emotion-engagement-detection', period: 'Jun – Sep 2026', category: 'Computer vision · MSc dissertation', featured: true,
      summary: "A full-stack computer vision app that reads a person's engagement from a live webcam and classifies it into six states, extended to detect boredom and fatigue.",
      tags: ['Python', 'FastAPI', 'TensorFlow', 'MediaPipe', 'OpenCV', 'TensorFlow.js'],
      metrics: ['6|Engagement states classified', '3|Fatigue signals: EAR, MAR, PERCLOS', '3.11|Stable Python build after resolving conflicts'],
      problem: 'Online learning and remote work make it hard to tell whether someone is engaged, confused or tired. I wanted a system that could read this from a normal webcam in real time.',
      approach: '- A **FastAPI** backend serves a **TensorFlow + MediaPipe + OpenCV** pipeline.\n- MediaPipe extracts facial landmarks from each frame; the model classifies six states: Happy, Engaged, Neutral, Confused, Bored and Frustrated.\n- I extended it to detect boredom and fatigue using **Eye Aspect Ratio (EAR)**, **Mouth Aspect Ratio (MAR)** and **PERCLOS**, drawing on the **DAiSEE** dataset.',
      results: 'The app runs end to end on live video. The hardest part was not the model: it was a chain of dependency conflicts across TensorFlow, MediaPipe, NumPy and TensorFlow.js, which I resolved by landing on a stable Python 3.11 environment. I wrote about that on LinkedIn in *The Bug That Taught Me More Than My MSc Did*.',
      gallery: [] },
    { title: 'Car wash booking platform', slug: 'car-wash-booking-platform', period: '2026', category: 'Full-stack',
      summary: 'Website and admin panel for a car wash in Peshawar: live slot booking that respects bay capacity, offers, gallery and a no-code settings panel.',
      tags: ['Node.js', 'Express', 'SQLite', 'JavaScript'],
      metrics: ['2|Bays tracked per time slot', '14|Days bookable ahead'],
      problem: 'A family car wash took bookings by phone and walk-in, with no way to stop two cars being promised the same bay.',
      approach: '- Node.js + Express server with a single-file SQLite database.\n- A slot algorithm that treats each booking as holding a bay for its service duration, checked inside a database transaction to stop double-booking.\n- A no-code admin panel for bookings, prices, offers, photos and opening hours.',
      results: 'Customers can book online and get a reference; the owner confirms and messages them on WhatsApp from the admin panel.',
      gallery: [] },
    { title: 'Fuel quantification with IoT', slug: 'fuel-quantification-iot', period: '2021 – 2022', category: 'IoT',
      summary: 'A flow sensor and NodeMCU stream real-time fuel use over Wi-Fi to a React Native app showing quantity and cost.',
      tags: ['NodeMCU', 'Arduino', 'React Native'], metrics: [],
      problem: 'Drivers have little visibility of how much fuel actually passes into the tank and what it costs.',
      approach: 'A liquid flow sensor measures fuel passing through the system. A NodeMCU microcontroller processes the readings and sends them over Wi-Fi to a React Native mobile app.',
      results: 'The app shows fuel quantity and cost in real time, improving fuel management and transparency.', gallery: [] },
    { title: 'Face-recognition attendance', slug: 'face-recognition-attendance', period: '2022', category: 'Machine learning',
      summary: 'Detects and recognises faces from a camera feed and records attendance automatically with date and time.',
      tags: ['Python', 'OpenCV', 'TensorFlow'], metrics: [],
      problem: 'Manual attendance is slow and open to proxy sign-ins.',
      approach: 'Faces are detected in real time from a camera feed and compared with a trained database of registered users using machine learning.',
      results: 'Attendance is marked automatically with date and time, reducing effort and preventing proxy attendance.', gallery: [] },
  ],
  experience: [
    { title: 'MSc Data Science', org: 'London South Bank University · London', period: 'Jan 2025 – Sep 2026', kind: 'education', bullets: ['Dissertation: real-time emotion & engagement detection (TensorFlow, MediaPipe, FastAPI).'] },
    { title: 'Operations Assistant', org: 'Cineworld Cinemas · London · part-time', period: 'Feb 2025 – present', kind: 'work', bullets: ['Supporting daily operations and resolving issues in a fast-paced venue.'] },
    { title: 'Software Engineer', org: 'AsTechSolutions · Peshawar · hybrid', period: 'Sep 2022 – Nov 2024', kind: 'work',
      bullets: ['Designed and built web applications from analysed requirements.', 'Worked across the lifecycle, from requirement gathering to production releases.', 'Modernised and modularised legacy code, cutting operating costs.', 'Tested programs and databases to find and fix issues.'] },
    { title: 'BSc Computer Software Engineering', org: 'CECOS University of IT & Emerging Sciences · Peshawar', period: 'Sep 2018 – Aug 2022', kind: 'education', bullets: [] },
  ],
  skills: [
    { group: 'Data & ML', items: ['Python', 'SQL', 'Machine Learning', 'Computer Vision', 'TensorFlow', 'scikit-learn', 'MediaPipe', 'OpenCV', 'Statistical analysis', 'Data mining'] },
    { group: 'Engineering', items: ['FastAPI', 'React', 'React Native', 'JavaScript', 'Node.js', 'SDLC', 'IoT & embedded'] },
    { group: 'Analysis & teams', items: ['Tableau', 'Matplotlib', 'Reporting', 'Research', 'Team leadership', 'Cyber security'] },
  ],
  testimonials: [],
  posts: [
    { title: 'The Bug That Taught Me More Than My MSc Did', slug: 'the-bug-that-taught-me', date: '2026-10-01', read_minutes: 3,
      summary: 'Four days stuck on one error while building my dissertation artefact.',
      external_url: 'https://www.linkedin.com/in/arbabjunaidkhan/recent-activity/articles/', body: '' },
    { title: 'The Human Side of Cybersecurity', slug: 'human-side-of-cybersecurity', date: '2026-09-01', read_minutes: 2,
      summary: 'Why awareness matters as much as firewalls and encryption.',
      external_url: 'https://www.linkedin.com/in/arbabjunaidkhan/recent-activity/articles/', body: '' },
  ],
};

module.exports = { SETTINGS, COLLECTIONS, SEED };
