---
title: "Compare JSON Schemas"
summary: "I got tired of comparing configuration files by eye, so I made a command-line tool do it."
kind: "software"
order: 2
featuredOrder: 2
category: "CLI"
technologies: ["TypeScript", "Node.js"]
externalUrl: "https://github.com/caiobep/compare-json-schemas"
externalLabel: "Open on GitHub"
visual:
  type: "code"
  lines:
    - "npm install -g compare-json-schemas"
    - "compare-schemas base.json copy.json config.yaml"
---

It started with configuration files that looked identical until they did not.

The rule is deliberately small:

1. Treat the first file as the expected shape.
2. Compare each file after it.
3. Report the drift across JSON, JSONC, and YAML.
