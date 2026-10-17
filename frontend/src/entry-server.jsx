import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import App from './App';

// Used only by scripts/prerender.mjs at build time: renders a public marketing route to an HTML string.
export function render(url) {
    return renderToString(
        <StaticRouter location={url}>
            <App />
        </StaticRouter>
    );
}
