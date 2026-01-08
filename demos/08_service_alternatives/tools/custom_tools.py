"""
Custom tools registration for service alternatives finder
"""
from openagents.models.tool import AgentTool
from .web_search import search_web_sync
from .web_fetch import fetch_webpage_sync


def get_searcher_tools():
    """Get custom tools for the searcher agent"""
    return [
        AgentTool(
            name="search_web",
            description="Search the web for information. Returns titles, URLs, and snippets.",
            input_schema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query"
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "Maximum number of results (default 5)",
                        "default": 5
                    }
                },
                "required": ["query"]
            },
            func=search_web_sync
        )
    ]


def get_comparer_tools():
    """Get custom tools for the comparer agent"""
    return [
        AgentTool(
            name="fetch_webpage",
            description="Fetch and extract content from a webpage. Returns title, description, pricing info, and main content.",
            input_schema={
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "The URL to fetch"
                    }
                },
                "required": ["url"]
            },
            func=fetch_webpage_sync
        )
    ]
