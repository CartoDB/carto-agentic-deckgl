# @carto/maps-ai-tools Documentation

This folder contains presentation materials for the `@carto/maps-ai-tools` library architecture.

## Presentation

The presentation is created using [Marp](https://marp.app/) - a Markdown-based presentation framework.

### Source File

- `maps-ai-tools-presentation.md` - The source Markdown file with Marp directives

### Generated Files

- `maps-ai-tools-presentation.pptx` - PowerPoint format
- `maps-ai-tools-presentation.html` - HTML format (can be opened in browser)
- `maps-ai-tools-presentation.pdf` - PDF format

## Usage

### Prerequisites

```bash
cd docs
npm install
```

### Build Commands

```bash
# Generate PowerPoint file
npm run build:pptx

# Generate PDF file
npm run build:pdf

# Generate HTML file
npm run build:html

# Generate all formats
npm run build:all

# Preview in browser with live reload
npm run preview

# Watch for changes and rebuild
npm run watch
```

### VS Code Extension

For the best editing experience, install the [Marp for VS Code](https://marketplace.visualstudio.com/items?itemName=marp-team.marp-vscode) extension. This allows you to:

- Preview slides as you edit
- Export directly from VS Code
- See IntelliSense for Marp directives

## Presentation Structure

The presentation covers:

1. **Executive Summary** - What & Why
2. **Architecture Overview** - High-Level Design
3. **Package: definitions** - Tool Schemas & Dictionary
4. **Package: executors** - Communication Utilities
5. **Communication Flow** - Request/Response Patterns
6. **Backend Integration** - Two Approaches
7. **Frontend Integration** - Framework Agnostic
8. **Custom Tools** - Extending the Library
9. **Getting Started** - Quick Setup

## Customization

### Themes

Marp has 3 built-in themes:
- `default` (current)
- `gaia`
- `uncover`

Change the theme in the front matter:

```yaml
---
marp: true
theme: gaia
---
```

### Custom Styles

Custom CSS can be added in the `style` directive in the front matter.

## Resources

- [Marp Documentation](https://marp.app/)
- [Marp CLI](https://github.com/marp-team/marp-cli)
- [Marp Core Syntax](https://marpit.marp.app/markdown)
