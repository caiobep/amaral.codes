<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" encoding="UTF-8" />

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title><xsl:value-of select="rss/channel/title" /> · RSS</title>
        <style>
          @font-face {
            font-family: "Instrument Sans";
            src: url("/fonts/instrument-sans-latin.woff2") format("woff2");
            font-display: swap;
          }

          @font-face {
            font-family: "Instrument Serif";
            src: url("/fonts/instrument-serif-latin.woff2") format("woff2");
            font-display: swap;
          }

          :root {
            color-scheme: light dark;
            --background: #f4f7f3;
            --surface: #edf5f1;
            --text: #111713;
            --muted: #626b66;
            --line: #ccd5d0;
            --accent: #145f57;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            background: var(--background);
            color: var(--text);
            font-family: "Instrument Sans", sans-serif;
          }

          main {
            width: min(760px, calc(100% - 40px));
            margin: 0 auto;
            padding: clamp(3rem, 8vw, 6rem) 0;
          }

          header {
            border-bottom: 1px solid var(--line);
            padding-bottom: clamp(2rem, 5vw, 3.5rem);
          }

          .label {
            margin: 0 0 1rem;
            color: var(--accent);
            font-size: 0.75rem;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
          }

          h1 {
            margin: 0;
            font-family: "Instrument Serif", serif;
            font-size: clamp(3rem, 10vw, 5.5rem);
            font-weight: 400;
            line-height: 0.95;
          }

          .description {
            max-width: 36rem;
            margin: 1.5rem 0 0;
            color: var(--muted);
            font-size: 1.05rem;
            line-height: 1.6;
          }

          .hint {
            margin: 1.5rem 0 0;
            padding: 1rem 1.1rem;
            border: 1px solid var(--line);
            background: var(--surface);
            color: var(--muted);
            line-height: 1.5;
          }

          ol {
            margin: 0;
            padding: 0;
            list-style: none;
          }

          li {
            border-bottom: 1px solid var(--line);
            padding: 1.75rem 0;
          }

          a {
            color: inherit;
            text-decoration-color: var(--accent);
            text-decoration-thickness: 1px;
            text-underline-offset: 0.22em;
          }

          h2 {
            margin: 0;
            font-size: clamp(1.35rem, 4vw, 1.75rem);
            line-height: 1.15;
          }

          time {
            display: block;
            margin-top: 0.65rem;
            color: var(--accent);
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
          }

          li p {
            margin: 0.8rem 0 0;
            color: var(--muted);
            line-height: 1.55;
          }

          @media (prefers-color-scheme: dark) {
            :root {
              --background: #0c1210;
              --surface: #121b18;
              --text: #f0f4ef;
              --muted: #aab4ae;
              --line: #2c3732;
              --accent: #8fd4c5;
            }
          }
        </style>
      </head>
      <body>
        <main>
          <header>
            <p class="label">RSS feed</p>
            <h1><xsl:value-of select="rss/channel/title" /></h1>
            <p class="description"><xsl:value-of select="rss/channel/description" /></p>
            <p class="hint">Subscribe by adding this page’s address to your preferred feed reader.</p>
          </header>

          <ol>
            <xsl:for-each select="rss/channel/item">
              <li>
                <h2>
                  <a href="{link}"><xsl:value-of select="title" /></a>
                </h2>
                <time><xsl:value-of select="pubDate" /></time>
                <p><xsl:value-of select="description" /></p>
              </li>
            </xsl:for-each>
          </ol>
        </main>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
