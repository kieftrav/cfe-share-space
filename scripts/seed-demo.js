// Populate the DB with representative demo content for review.
// Run once against a fresh cfe.sqlite, then start the server.
import * as C from '../server/content.js'

function svg(label, color) {
  const s = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='360'><rect width='600' height='360' fill='${color}'/><text x='50%' y='46%' fill='white' font-size='36' font-family='sans-serif' font-weight='700' text-anchor='middle'>${label}</text><text x='50%' y='60%' fill='rgba(255,255,255,.7)' font-size='18' font-family='sans-serif' text-anchor='middle'>CFE demo screenshot</text></svg>`
  return 'data:image/svg+xml;base64,' + Buffer.from(s).toString('base64')
}

// CFE catalog
C.create({ type: 'cfe', title: 'Galaxy Zoo Clump Scout', body_markdown: 'A brush-based front end for marking clumps in galaxy images.', metadata: { github_url: 'https://github.com/zooniverse/clump-scout', tagline: 'Mark clumps in galaxies', tags: ['drawing', 'galaxies'], image: svg('Clump Scout', '#1f6feb') } }, null)
C.create({ type: 'cfe', title: 'Cosmic Canvas', body_markdown: 'A no-build brush-tool classifier deployed to GitHub Pages.', metadata: { github_url: 'https://github.com/astrohayley/cosmic-canvas', live_url: 'https://astrohayley.github.io/cosmic-canvas/', tagline: 'Paint-to-classify', tags: ['canvas', 'no-build'], image: svg('Cosmic Canvas', '#7c3aed') } }, null)
C.create({ type: 'cfe', title: 'Zoo Playground', body_markdown: 'A forkable, config-driven Zooniverse classifier template.', metadata: { github_url: 'https://github.com/kieftrav/zoo-playground', tagline: 'Fork-and-go classifier', tags: ['template', 'vite'], image: svg('Zoo Playground', '#059669') } }, null)

// Discussion
const cat = C.create({ type: 'category', title: 'General Discussion', body_markdown: 'Questions and tips about building CFEs.' }, null)
const thread = C.create({ type: 'thread', parent_id: cat.id, title: 'How do I add a brush tool to my classifier?', body_markdown: 'I want freehand drawing on the subject image. Where should the tool state live?' }, null)
C.create({ type: 'reply', parent_id: thread.id, body_markdown: 'Keep the tool state on the workflow task. See the reference component:', metadata: { code_ref: { repo_path: 'src/components/BrushTool.jsx', github_url: 'https://github.com/kieftrav/zoo-playground/blob/main/src/components/BrushTool.jsx', line_start: 10, line_end: 40 } } }, null)

// News
C.create({ type: 'announcement', title: 'CFE Share Space is live', body_markdown: 'Welcome! Browse the **CFE catalog**, start a **discussion**, and check the **resources**. Sign in with your Zooniverse account to contribute.' }, null)

// Featured (elevates the thread)
C.create({ type: 'featured', title: 'Editor’s pick: adding drawing tools', body_markdown: 'A great walkthrough on where tool state belongs — useful for anyone building a marking interface.', metadata: { links_content_id: thread.id } }, null)

// Resources
const res = C.create({ type: 'section', title: 'Resources', slug: 'resources' }, null)
C.create({ type: 'page', parent_id: res.id, title: 'Getting Started', body_markdown: '# Getting Started\n\n1. Fork a template (Zoo Playground, Cosmic Canvas).\n2. Point it at your Zooniverse project.\n3. Share it here in the **CFE catalog**.' }, null)
C.create({ type: 'page', parent_id: res.id, title: 'FAQ', body_markdown: '# FAQ\n\n**Who can post?** Whitelisted researchers and Zooniverse staff.\n\n**Where does code live?** In your own GitHub repo — link it from a CFE entry.' }, null)
C.create({ type: 'external_link', parent_id: res.id, title: 'API Documentation', metadata: { href: 'https://help.zooniverse.org/' } }, null)

console.log('Seeded demo content.')
