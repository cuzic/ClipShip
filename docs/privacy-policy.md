# Privacy Policy for ClipShip

*Last updated: 2024*

## Overview

ClipShip is a Chrome extension that deploys clipboard content to Netlify or GitHub Gist. This privacy policy explains how we handle your data.

## Data Collection

### What We Collect

ClipShip does **NOT** collect, store, or transmit any personal data to our servers. We do not have any servers or analytics.

### Data Stored Locally

The following data is stored locally in your browser using Chrome's sync storage:

| Data | Purpose | Storage |
|------|---------|---------|
| Netlify Personal Access Token | Authenticate with Netlify API | Chrome sync storage |
| GitHub Personal Access Token | Authenticate with GitHub API | Chrome sync storage |
| Netlify Site ID | Remember your ClipShip site | Chrome sync storage |

This data is:
- Stored only in your browser
- Synced across your Chrome browsers via your Google account (Chrome sync)
- Never sent to any third-party servers other than the respective APIs
- Deleted when you uninstall the extension

### Clipboard Data

When you click the deploy button, ClipShip reads your clipboard content. This content is:
- Sent directly to Netlify or GitHub APIs for deployment
- Never stored locally beyond the deployment process
- Never sent to any other third party

## Third-Party Services

ClipShip integrates with the following services:

### Netlify

- Website: https://www.netlify.com
- Privacy Policy: https://www.netlify.com/privacy/
- Data sent: Your clipboard content (for deployment)
- Authentication: Your Netlify Personal Access Token

### GitHub

- Website: https://github.com
- Privacy Policy: https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement
- Data sent: Your clipboard content (for Gist creation)
- Authentication: Your GitHub Personal Access Token

### CDN Resources

When viewing deployed Markdown content, the following CDN resources may be loaded:
- highlight.js (syntax highlighting) from jsDelivr
- Mermaid.js (diagrams) from jsDelivr

These are loaded in the deployed page, not by the extension itself.

## Permissions Used

| Permission | Why We Need It |
|------------|----------------|
| clipboardRead | To read content you want to deploy |
| storage | To save your API tokens securely |
| tabs | To open deployed URLs in new tabs |
| https://api.netlify.com/* | To communicate with Netlify API |
| https://api.github.com/* | To communicate with GitHub API |

## Data Security

- API tokens are stored using Chrome's secure sync storage
- All API communications use HTTPS
- HTML in Markdown content is sanitized to prevent XSS attacks
- No data is logged or stored on external servers

## Your Rights

You can:
- View your stored tokens in the extension's Options page
- Delete your tokens at any time via Options
- Uninstall the extension to remove all stored data
- Revoke API tokens from Netlify/GitHub dashboards

## Children's Privacy

ClipShip does not knowingly collect any personal information from children under 13 years of age.

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be reflected in the "Last updated" date above.

## Open Source

ClipShip is open source. You can review the code to verify our privacy practices:
https://github.com/[your-username]/clipship

## Contact

If you have any questions about this privacy policy, please create an issue on our GitHub repository.

---

## Summary

- **We don't collect your data**
- **Tokens stay in your browser**
- **Clipboard content goes directly to Netlify/GitHub**
- **No analytics, no tracking, no servers**
