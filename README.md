# Obsidian Vision Insights

AI-powered image analysis for Obsidian with contextual insights using OpenAI's Vision API.

## Overview

Vision Insights is an Obsidian plugin that brings AI-powered image analysis directly into your note-taking workflow. Simply right-click on any image link in your notes to select insights, summaries, text extraction, and detailed analysis using OpenAI's advanced vision models.

## Features

### 🎯 **10 Specialized Analysis Actions**

- **📝 Smart Summary** - Focused 2-3 sentence summaries capturing core messages and key takeaways
- **📊 Extract Key Facts** - Organized bulleted lists of specific data points, metrics, and actionable items
- **🖼️ Generate Description** - Comprehensive visual descriptions for accessibility and archival purposes
- **🔤 Identify Text (OCR)** - Complete text extraction with preserved formatting and structure
- **🏗️ Analyze Structure** - Detailed breakdown of organizational patterns and information architecture
- **💡 Quick Insights** - 4-6 actionable insights that go beyond surface-level observations
- **📈 Analyze Data Visualization** - Specialized analysis for charts, graphs, and data visualizations
- **👥 Extract Meeting Participants** - List all visible meeting participants, names, avatars, and roles from screenshots
- **🗂️ Analyze Meeting Content** - Comprehensive analysis of meeting screenshots, shared content, context, and action items
- **✍️ Custom Vision Prompt** - Provide your own prompt; output is guaranteed Obsidian Markdown

### 🚀 **Smart Integration**

- **Context Menu Integration** - Right-click any image for instant analysis
- **Universal Image Support** - Works with `![[image.png]]`, `![](image.png)`, and `<img>` syntax
- **External Image Support** - Analyze both vault images and external URLs
- **Multiple Insertion Modes** - Insert results at cursor, as blockquotes, callouts, new notes, daily notes, above/below the image, or replacing the image with a callout

### ⚡ **Performance & Efficiency**

- **Intelligent Caching** - Avoid repeat API calls with configurable cache duration and LRU cap
- **Rate Limiting** - Built-in request throttling to prevent API limits
- **Model Selection** - Choose between GPT-5 Mini, GPT-5 Nano, and GPT-5.2
- **Batch Processing** - Analyze all images in the current note and aggregate results
- **Optional Downscaling** - Reduce large image sizes before upload to save cost/time

## Installation

### Via Obsidian Community Plugins (once available)

1. Open Obsidian Settings
2. Go to **Community Plugins** and disable **Safe Mode**
3. Click **Browse** and search for "Vision Insights"
4. Install and enable the plugin

### Manual Installation

1. Download the latest release from the [releases page](https://github.com/batjko/obsidian-vision-insights/releases)
2. Extract the files to your vault's plugins folder: `VaultFolder/.obsidian/plugins/vision-insights/`
3. Reload Obsidian and enable the plugin in Community Plugins
4. Add your OpenAI API key in the settings and enable whichever context actions you want.

### Development Installation

```bash
# Clone the repository
git clone https://github.com/batjko/obsidian-vision-insights.git
cd obsidian-vision-insights

# Install dependencies
npm install

# Build for development
npm run dev

# Build for production
npm run build
```

## Setup

### 1. Get OpenAI API Key

1. Visit [OpenAI Platform](https://platform.openai.com)
2. Create an account or sign in
3. Navigate to API Keys section
4. Generate a new API key

### 2. Configure Plugin

1. Open Obsidian Settings
2. Go to **Vision Insights** in the plugin settings
3. Enter your OpenAI API key
4. Click **Test Connection** to verify
5. Customize your preferred settings

## Usage

### Basic Usage

1. **Right-click on any image link** in your notes
2. **Select an analysis action** from the Vision Insights menu
3. **Wait for analysis** (usually 3-10 seconds)
4. **Review results** in the popup modal
5. **Insert content** using your preferred format

### Supported Image Formats

- **Vault Images**: `![[image.png]]` or `![Alt text](image.png)`
- **External URLs**: `![](https://example.com/image.jpg)`
- **HTML Images**: `<img src="image.png" alt="description">`
- **File Types**: PNG, JPG, JPEG, GIF, WebP, BMP, TIFF

### Insertion Modes

- **At Cursor Position** - Insert directly where your cursor is located
- **As Blockquote** - Wrap content in `>` blockquote formatting  
- **As Callout** - Create Obsidian callout blocks with analysis results
- **Create New Note** - Generate a dedicated note for the analysis
- **Append to Daily Note** - Add to today's daily note
- **Insert Above/Below Image** - Place content adjacent to the image
- **Replace Image with Callout** - Swap the image for a formatted callout

## Configuration Options

### API Settings

- **OpenAI API Key** - Your OpenAI API key for vision analysis
- **Preferred Model** - Choose between GPT-5 Mini (recommended), GPT-5 Nano, and GPT-5.2
- **Test Connection** - Verify API key validity

### Analysis Actions

Enable/disable specific analysis types:
- Smart Summary
- Extract Key Facts  
- Generate Description
- Identify Text (OCR)
- Analyze Structure
- Quick Insights
- Analyze Data Visualization

### Performance Settings

- **Caching** - Cache results to avoid repeat API calls (configurable duration: 1-168 hours) with max entries
- **Rate Limiting** - Minimum delay between requests (100-2000ms)
- **Default Insertion Mode** - Choose how results are inserted by default
- **Downscaling** - Toggle and max dimension for local images
- **Per-Action Overrides** - Model, temperature, image detail, and insertion mode per action

## Examples

### Smart Summary
```
This chart shows quarterly revenue growth from Q1 2023 to Q4 2023, with a notable 23% increase in Q4. The data indicates strong momentum in the enterprise segment, particularly in SaaS subscriptions which grew 45% year-over-year.
```

### Extract Key Facts
```
• Q4 2023 revenue: $2.4M (23% increase)
• SaaS subscriptions: 45% YoY growth  
• Enterprise segment: 67% of total revenue
• Customer acquisition cost: $1,200 (down 15%)
• Monthly recurring revenue: $890K
```

### Quick Insights
```
• The sharp Q4 uptick suggests successful holiday marketing campaigns
• Enterprise focus is paying off with higher-value, stickier customers
• Declining CAC indicates improving marketing efficiency and brand recognition
• SaaS growth outpacing overall revenue suggests successful product-market fit
• Strong momentum entering 2024 with recurring revenue foundation
```

## Development

### Project Structure

```
obsidian-vision-insights/
├── src/
│   ├── types.ts           # TypeScript interfaces and types
│   ├── settings.ts        # Plugin settings UI and management
│   ├── image-handler.ts   # Image detection and processing
│   ├── openai-client.ts   # OpenAI API integration
│   ├── results-modal.ts   # Results display modal
│   ├── cache-manager.ts   # Caching system
│   └── utils.ts          # Utility functions
├── main.ts               # Main plugin entry point
├── manifest.json         # Plugin metadata
├── package.json          # Dependencies and scripts
└── esbuild.config.mjs    # Build configuration
```

### Key Technologies

- **TypeScript** - Type-safe development
- **OpenAI API v5** - Vision analysis capabilities
- **Obsidian API** - Native plugin integration
- **ESBuild** - Fast compilation and bundling

### Build Scripts

```bash
npm run dev        # Development build with watch mode
npm run build      # Production build
npm run release    # Create release package
```

### Release Process

This plugin uses semantic versioning. To create a new release:

**Interactive Release**
```bash
npm run release
```
This will prompt you to select the type of version bump (patch, minor, or major).

**Direct Release**
```bash
npm run release:patch   # For bug fixes (1.0.0 → 1.0.1)
npm run release:minor   # For new features (1.0.0 → 1.1.0)  
npm run release:major   # For breaking changes (1.0.0 → 2.0.0)
```

The release script will:
1. Bump the version in `package.json`, `manifest.json`, and `versions.json`
2. Build the plugin
3. Commit and tag the changes
4. Push to GitHub
5. Create a GitHub release with the built assets

**Manual Release**
If you need to release the current version without bumping:
```bash
node scripts/release.mjs skip
```

### Contributing

1. The usual: Fork and submit a pull request
2. Try to stick to the existing conventions.
3. KISS

## Troubleshooting

### Common Issues

**Plugin won't load**
- Check Obsidian version compatibility (minimum 0.15.0)
- Verify all files are in the correct plugin directory
- Check browser console for error messages

**API key errors**
- Ensure API key is correctly entered without extra spaces
- Verify API key has sufficient credits and permissions
- Test connection using the built-in test button

**Image detection fails**
- Check image file exists and is accessible
- Verify image format is supported
- Try different image syntax formats

**Slow analysis**
- Check internet connection
- Consider using faster model (GPT-5 Nano)
- Adjust rate limiting settings if needed

## Privacy & Security

- **API Key Storage** - Stored locally in Obsidian's plugin data
- **Image Processing** - Images sent to OpenAI for analysis according to their privacy policy
- **No Telemetry** - Plugin doesn't collect or transmit usage data

## Acknowledgments

- Built for the [Obsidian](https://obsidian.md) knowledge management platform
- Powered by [OpenAI's Vision API](https://platform.openai.com/docs/guides/vision)
- Inspired by the Obsidian community's innovation in knowledge tools
