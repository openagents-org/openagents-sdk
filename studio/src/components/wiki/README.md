# Wiki Components

This directory contains the React components for the Wiki mod integration in OpenAgents Studio.

## Components

### WikiView
The main wiki interface component that provides:

- **Page Listing**: Browse all wiki pages with search functionality
- **Page Creation**: Create new wiki pages with path, title, and content
- **Page Viewing**: Read wiki pages with full content display
- **Page Editing**: Direct editing for page owners
- **Edit Proposals**: Non-owners can propose edits with rationale
- **Proposal Management**: Review and approve/reject edit proposals

## Features

### Page Management
- Create new wiki pages with custom paths (e.g., `/getting-started`)
- View page details including creator, version, and last modified date
- Search through all wiki pages by content and title

### Collaborative Editing
- **Direct Editing**: Page creators/owners can edit pages directly
- **Proposal System**: Other users can propose edits with rationale
- **Review Process**: Pending proposals can be reviewed and approved/rejected

### User Interface
- **Responsive Design**: Works on different screen sizes
- **Dark/Light Theme**: Supports both theme modes
- **Real-time Updates**: Uses event-based system for live updates
- **Intuitive Navigation**: Easy switching between list, page, and edit views

## Integration

The WikiView is integrated into the main Studio application through:

1. **ModSidebar**: Wiki icon appears when wiki mod is detected
2. **App.tsx**: Wiki view is rendered when selected
3. **WikiService**: Detects wiki mod availability from network health
4. **Event System**: Uses OpenAgents event system for all operations

## Events Used

The component sends the following events to the wiki mod:

- `wiki.pages.list` - List all wiki pages
- `wiki.pages.search` - Search wiki pages
- `wiki.page.get` - Get specific page content
- `wiki.page.create` - Create new page
- `wiki.page.edit` - Edit existing page (owner only)
- `wiki.page.propose` - Propose edit to page
- `wiki.proposals.list` - List edit proposals
- `wiki.proposal.resolve` - Approve/reject proposals

## Usage

The WikiView component is automatically available when:

1. The wiki mod (`openagents.mods.workspace.wiki`) is loaded in the network
2. The studio detects the mod through the health check endpoint
3. The wiki icon appears in the left sidebar

Users can then:
1. Click the wiki icon to access the wiki
2. Browse existing pages or create new ones
3. Edit pages they own or propose edits to others' pages
4. Review and manage edit proposals if they have permissions
