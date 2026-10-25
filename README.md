# Git-Upload

Static site, no build step, no backend. Everything runs in the browser against the GitHub API.

## Deploy to Vercel
1. Push this folder to a GitHub repository.
2. In Vercel choose Add New, Project, import the repository.
3. Framework Preset: Other. Leave build and output settings empty. Deploy.

Or with the CLI: `npm i -g vercel && vercel --prod` from this folder.

## Local preview
`npx serve .` then open the printed address.

## Notes
- Use a classic personal access token with the `repo` scope. The token is kept in sessionStorage only.
- Zip extraction needs a browser with DecompressionStream (Chrome 103, Safari 16.4, Firefox 113 or newer).
- New uploads need an existing branch; repositories created here are initialised with a README.
