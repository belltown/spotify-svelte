import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
        adapter: adapter({
            // GitHub Pages serves a 404.html page for any route that does not exist in the repo
            //fallback: '404.html'
        }),
        paths: {
            // BASE_PATH is defined in .gitgub/workflows/deploy.yml for GitHub Pages build workflow,
            // otherwise BASE_PATH will be undefined (local build, or production build on local machine)
            base: process.env.BASE_PATH || ''
        },
        csp: {
            mode: 'auto',
            directives: {
                'object-src': ['none'],
                'script-src': ['self'],
                'base-uri': ['self'],
            }
        }
    }
};

export default config;
