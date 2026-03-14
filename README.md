# Better Link Clicker

An Obsidian plugin that modifies the default click behavior of bidirectional links.

Directly clicking on a link no longer redirects you, but instead edits the link (in live mode).

When a user clicks on a link that does not have a note below it, a confirmation window is displayed before a new note is created.

Both of the above features can be configured in the settings panel.

## Modifier clicks

This plugin intercepts normal link clicks so you can edit links without navigating.

When you use Obsidian's modifier-click behavior to open a link in another pane (tab/split/window), the plugin respects that. For example, Ctrl+Alt+Shift+Click (or the equivalent on macOS) will open the link in a new window.

## Supported link types

The plugin currently handles the following link syntaxes in the editor (especially Live Preview):

| Type | Syntax examples | Supported |
| --- | --- | --- |
| Wikilink (internal) | `[[Note]]`, `[[Note\|Alias]]`, `[[Note#Heading]]` | Yes |
| Wikilink embed (internal) | `![[Note]]`, `![[image.png]]` | Yes |
| Markdown link to internal target | `[PyTorch](PyTorch)`, `[Doc](folder/Doc.md#section)` | Yes |
| Markdown link to external URL | `[GitHub](https://github.com)`, `[Mail](mailto:test@example.com)` | Yes |
| Plain URL text | `https://github.com`, `mailto:test@example.com`, `//example.com` | Yes |

### Behavior notes

- `Jump only with modifier` applies to all handled link types above.
- `Open link at new tab` only applies to internal note navigation.
- External URLs always open as external links (system/browser behavior), not as Obsidian internal tabs.
