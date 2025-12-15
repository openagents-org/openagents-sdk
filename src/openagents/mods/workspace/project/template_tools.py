"""
Template tools generator for the Project mod.

This module provides utilities to generate AgentTool instances from ProjectTemplates
that have expose_as_tool enabled. Each template becomes a standalone tool with
its own customizable input schema.
"""

from typing import Any, Callable, Dict, List, Optional
import copy

from openagents.models.tool import AgentTool
from openagents.workspace.project import ProjectTemplate


DEFAULT_INPUT_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "goal": {
            "type": "string",
            "description": "The project goal or objective"
        },
        "name": {
            "type": "string",
            "description": "Optional project name"
        },
        "collaborators": {
            "type": "array",
            "items": {"type": "string"},
            "description": "List of additional agent IDs to collaborate"
        }
    },
    "required": ["goal"]
}


def generate_template_tool_name(template_id: str, custom_name: Optional[str] = None) -> str:
    """
    Generate tool name from template ID.

    Args:
        template_id: The template identifier
        custom_name: Optional custom name to use instead

    Returns:
        The tool name (custom_name if provided, otherwise start_{template_id}_project)
    """
    if custom_name:
        return custom_name
    # Convert template_id to snake_case tool name
    return f"start_{template_id}_project"


def generate_template_tool_description(template: ProjectTemplate) -> str:
    """
    Generate tool description from template.

    Args:
        template: The project template

    Returns:
        The tool description (custom if provided, otherwise derived from template)
    """
    if template.tool_description:
        return template.tool_description

    base_desc = f"Start a new '{template.name}' project."
    if template.description:
        return f"{base_desc} {template.description}"
    return base_desc


def merge_input_schemas(
    base_schema: Dict[str, Any],
    custom_schema: Optional[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Merge custom schema with base schema, custom takes precedence.

    Args:
        base_schema: The default input schema
        custom_schema: Optional custom schema to merge

    Returns:
        The merged schema
    """
    if not custom_schema:
        return copy.deepcopy(base_schema)

    # Start with custom schema as base
    merged = copy.deepcopy(custom_schema)

    # Ensure type is set
    if "type" not in merged:
        merged["type"] = "object"

    # Ensure properties exist
    if "properties" not in merged:
        merged["properties"] = {}

    # Ensure goal property exists (it's always required)
    if "goal" not in merged["properties"]:
        merged["properties"]["goal"] = {
            "type": "string",
            "description": "The project goal or objective"
        }

    # Always require 'goal' at minimum
    if "required" not in merged:
        merged["required"] = ["goal"]
    elif "goal" not in merged["required"]:
        merged["required"] = list(merged["required"])
        merged["required"].append("goal")

    return merged


def create_template_tool(
    template: ProjectTemplate,
    start_project_handler: Callable[..., Any]
) -> AgentTool:
    """
    Create an AgentTool from a ProjectTemplate.

    Args:
        template: The project template to create a tool for
        start_project_handler: Async callable that handles project creation

    Returns:
        An AgentTool instance configured for this template
    """
    tool_name = generate_template_tool_name(template.template_id, template.tool_name)
    tool_description = generate_template_tool_description(template)
    input_schema = merge_input_schemas(DEFAULT_INPUT_SCHEMA, template.input_schema)

    # Capture template_id in closure
    captured_template_id = template.template_id

    async def tool_func(**kwargs: Any) -> Dict[str, Any]:
        """Execute template-specific project start."""
        # Extract standard parameters
        goal = kwargs.get("goal")
        name = kwargs.get("name") or kwargs.get("project_name")
        collaborators = kwargs.get("collaborators", [])

        # Store custom parameters in project metadata/context
        standard_params = {"goal", "name", "project_name", "collaborators"}
        custom_params = {k: v for k, v in kwargs.items() if k not in standard_params}

        return await start_project_handler(
            template_id=captured_template_id,
            goal=goal,
            name=name,
            collaborators=collaborators,
            custom_params=custom_params
        )

    return AgentTool(
        name=tool_name,
        description=tool_description,
        input_schema=input_schema,
        func=tool_func
    )


def generate_template_tools(
    templates: Dict[str, ProjectTemplate],
    start_project_handler: Callable[..., Any]
) -> List[AgentTool]:
    """
    Generate tools for all templates with expose_as_tool=True.

    Args:
        templates: Dictionary of template_id -> ProjectTemplate
        start_project_handler: Async callable that handles project creation

    Returns:
        List of AgentTool instances for exposed templates
    """
    tools: List[AgentTool] = []

    for template_id, template in templates.items():
        if template.expose_as_tool:
            tool = create_template_tool(template, start_project_handler)
            tools.append(tool)

    return tools


def validate_template_tool_names(templates: Dict[str, ProjectTemplate]) -> List[str]:
    """
    Validate that all template tool names are unique.

    Args:
        templates: Dictionary of template_id -> ProjectTemplate

    Returns:
        List of error messages (empty if all names are unique)
    """
    errors: List[str] = []
    seen_names: Dict[str, str] = {}  # tool_name -> template_id

    for template_id, template in templates.items():
        if not template.expose_as_tool:
            continue

        tool_name = generate_template_tool_name(template.template_id, template.tool_name)

        if tool_name in seen_names:
            errors.append(
                f"Duplicate tool name '{tool_name}' found in templates "
                f"'{seen_names[tool_name]}' and '{template_id}'"
            )
        else:
            seen_names[tool_name] = template_id

    return errors
