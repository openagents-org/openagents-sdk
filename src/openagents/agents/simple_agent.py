import os
import json
import asyncio
import logging
from typing import Dict, List, Any, Optional, Union

from openagents.agents.runner import AgentRunner
from openagents.models.event_thread import EventThread
from openagents.models.event import Event
from openagents.models.tool import AgentAdapterTool
from openagents.utils.verbose import verbose_print
from openagents.lms import (
    BaseModelProvider,
    OpenAIProvider,
    AnthropicProvider,
    BedrockProvider,
    GeminiProvider,
    SimpleGenericProvider
)
from jinja2 import Template

logger = logging.getLogger(__name__)

# Prompt template for conversation formatting
user_prompt_template = Template("""
<conversation>
    <threads>
        {% for thread_id, thread in event_threads.items() %}
        <thread id="{{ thread_id }}">
            {% for message in thread.messages[-10:] %}
            <message sender="{{ message.source_id }}">
                {% if message.text_representation %}
                <content>{{ message.text_representation }}</content>
                {% else %}
                <content>{{ message.payload }}</content>
                {% endif %}
            </message>
            {% endfor %}
        </thread>
        {% endfor %}
    </threads>
    
    <current_interaction>
        <incoming_thread_id>{{ incoming_thread_id }}</incoming_thread_id>
        <incoming_message sender="{{ incoming_message.source_id }}">
            {% if incoming_message.text_representation %}
            <content>{{ incoming_message.text_representation }}</content>
            {% else %}
            <content>{{ incoming_message.payload }}</content>
            {% endif %}
        </incoming_message>
    </current_interaction>
</conversation>

Please respond to the incoming message based on the context provided. You have access to tools that you can use if needed.
In each step, you MUST either:
1. Call a tool to perform an action, or
2. Use the finish tool when you've completed all necessary actions.

If you don't need to use any tools, use the finish tool directly.
""")



class SimpleAgentRunner(AgentRunner):
    """Unified agent runner supporting multiple model providers."""
    
    # Predefined model configurations
    MODEL_CONFIGS = {
        # OpenAI models
        "openai": {
            "provider": "openai",
            "models": ["gpt-4", "gpt-4-turbo", "gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"]
        },
        # Azure OpenAI
        "azure": {
            "provider": "openai",
            "models": ["gpt-4", "gpt-4-turbo", "gpt-35-turbo"]
        },
        # Anthropic Claude
        "claude": {
            "provider": "anthropic",
            "models": ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"]
        },
        # AWS Bedrock
        "bedrock": {
            "provider": "bedrock",
            "models": ["anthropic.claude-3-sonnet-20240229-v1:0", "anthropic.claude-3-haiku-20240307-v1:0"]
        },
        # Google Gemini
        "gemini": {
            "provider": "gemini",
            "models": ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"]
        },
        # DeepSeek
        "deepseek": {
            "provider": "generic",
            "api_base": "https://api.deepseek.com/v1",
            "models": ["deepseek-chat", "deepseek-coder"]
        },
        # Qwen
        "qwen": {
            "provider": "generic", 
            "api_base": "https://dashscope.aliyuncs.com/compatible-mode/v1",
            "models": ["qwen-turbo", "qwen-plus", "qwen-max"]
        },
        # Grok (xAI)
        "grok": {
            "provider": "generic",
            "api_base": "https://api.x.ai/v1",
            "models": ["grok-beta"]
        },
        # Mistral AI
        "mistral": {
            "provider": "generic",
            "api_base": "https://api.mistral.ai/v1",
            "models": ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest", "mixtral-8x7b-instruct"]
        },
        # Cohere
        "cohere": {
            "provider": "generic",
            "api_base": "https://api.cohere.ai/v1",
            "models": ["command-r-plus", "command-r", "command"]
        },
        # Together AI (hosts many open models)
        "together": {
            "provider": "generic",
            "api_base": "https://api.together.xyz/v1",
            "models": ["meta-llama/Llama-2-70b-chat-hf", "mistralai/Mixtral-8x7B-Instruct-v0.1"]
        },
        # Perplexity
        "perplexity": {
            "provider": "generic",
            "api_base": "https://api.perplexity.ai",
            "models": ["llama-3.1-sonar-huge-128k-online", "llama-3.1-sonar-large-128k-online"]
        }
    }
    
    def __init__(
        self,
        agent_id: str,
        model_name: str,
        instruction: str,
        provider: Optional[str] = None,
        api_base: Optional[str] = None,
        api_key: Optional[str] = None,
        protocol_names: Optional[List[str]] = None,
        ignored_sender_ids: Optional[List[str]] = None,
        **kwargs
    ):
        """Initialize the SimpleAgentRunner.
        
        Args:
            agent_id: Unique identifier for this agent
            model_name: Name of the model to use
            instruction: System instruction/prompt for the agent
            provider: Model provider (openai, claude, bedrock, gemini, deepseek, qwen, grok)
            api_base: Custom API base URL (overrides provider defaults)
            api_key: API key (if not provided, will use environment variables)
            protocol_names: List of protocol names to register with
            ignored_sender_ids: List of sender IDs to ignore
            **kwargs: Additional provider-specific configuration
        """
        super().__init__(agent_id=agent_id, mod_names=protocol_names, ignored_sender_ids=ignored_sender_ids)
        
        self.model_name = model_name
        self.instruction = instruction
        
        # Determine provider and initialize model provider
        self.provider = self._determine_provider(provider, model_name, api_base)
        self.model_provider = self._create_model_provider(api_base, api_key, kwargs)
    
    def _determine_provider(self, provider: Optional[str], model_name: str, api_base: Optional[str]) -> str:
        """Determine the model provider based on configuration."""
        
        if provider:
            return provider.lower()
        
        # Auto-detect provider based on model name or API base
        if api_base:
            if "azure.com" in api_base:
                return "azure"
            elif "deepseek.com" in api_base:
                return "deepseek"
            elif "aliyuncs.com" in api_base:
                return "qwen"
            elif "x.ai" in api_base:
                return "grok"
            elif "anthropic.com" in api_base:
                return "claude"
            elif "googleapis.com" in api_base:
                return "gemini"
        
        # Auto-detect based on model name
        model_lower = model_name.lower()
        if any(name in model_lower for name in ["gpt", "openai"]):
            return "openai"
        elif any(name in model_lower for name in ["claude"]):
            return "claude"
        elif any(name in model_lower for name in ["gemini"]):
            return "gemini"
        elif any(name in model_lower for name in ["deepseek"]):
            return "deepseek"
        elif any(name in model_lower for name in ["qwen"]):
            return "qwen"
        elif any(name in model_lower for name in ["grok"]):
            return "grok"
        elif any(name in model_lower for name in ["mistral", "mixtral"]):
            return "mistral"
        elif any(name in model_lower for name in ["command"]):
            return "cohere"
        elif "llama" in model_lower or "meta-" in model_lower:
            return "together"
        elif "sonar" in model_lower:
            return "perplexity"
        elif "anthropic." in model_name:
            return "bedrock"
        
        # Default to OpenAI
        return "openai"
    
    def _create_model_provider(self, api_base: Optional[str], api_key: Optional[str], kwargs: Dict[str, Any]) -> BaseModelProvider:
        """Create the appropriate model provider."""
        
        if self.provider == "openai" or self.provider == "azure":
            return OpenAIProvider(
                model_name=self.model_name,
                api_base=api_base,
                api_key=api_key,
                **kwargs
            )
        elif self.provider == "claude":
            return AnthropicProvider(
                model_name=self.model_name,
                api_key=api_key,
                **kwargs
            )
        elif self.provider == "bedrock":
            return BedrockProvider(
                model_name=self.model_name,
                **kwargs
            )
        elif self.provider == "gemini":
            return GeminiProvider(
                model_name=self.model_name,
                api_key=api_key,
                **kwargs
            )
        elif self.provider in ["deepseek", "qwen", "grok", "mistral", "cohere", "together", "perplexity"]:
            # Use predefined API base if not provided
            if not api_base and self.provider in self.MODEL_CONFIGS:
                api_base = self.MODEL_CONFIGS[self.provider]["api_base"]
            
            if not api_base:
                raise ValueError(f"API base URL required for provider: {self.provider}")
            
            return SimpleGenericProvider(
                model_name=self.model_name,
                api_base=api_base,
                api_key=api_key,
                **kwargs
            )
        else:
            raise ValueError(f"Unsupported provider: {self.provider}")
    
    def _create_finish_tool(self):
        """Create a tool that allows the model to indicate it's finished with actions."""
        return AgentAdapterTool(
            name="finish",
            description="Use this tool when you have completed all necessary actions and don't need to do anything else.",
            input_schema={
                "type": "object",
                "properties": {
                    "reason": {
                        "type": "string",
                        "description": "Reason for finishing the action chain."
                    }
                },
                "required": ["reason"]
            },
            func=lambda reason: f"Action chain completed: {reason}"
        )
    
    async def react(self, event_threads: Dict[str, EventThread], incoming_thread_id: str, incoming_message: Event):
        """React to an incoming message using the configured model provider."""
        verbose_print(f">>> Reacting to message: {incoming_message.text_representation} (thread:{incoming_thread_id})")
        
        # Generate the prompt using the template
        prompt_content = user_prompt_template.render(
            event_threads=event_threads,
            incoming_thread_id=incoming_thread_id,
            incoming_message=incoming_message
        )
        
        # Create messages with instruction as system message and prompt as user message
        messages = [
            {"role": "system", "content": self.instruction},
            {"role": "user", "content": prompt_content}
        ]
        
        # Convert tools to provider format and add the finish tool
        all_tools = list(self.tools)
        finish_tool = self._create_finish_tool()
        all_tools.append(finish_tool)
        
        formatted_tools = self.model_provider.format_tools(all_tools)
        
        # Start the conversation with the model
        is_finished = False
        max_iterations = 10  # Prevent infinite loops
        iteration = 0
        
        while not is_finished and iteration < max_iterations:
            iteration += 1
            
            try:
                # Call the model provider
                response = await self.model_provider.chat_completion(messages, formatted_tools)
                
                # Add the assistant's response to the conversation
                messages.append({
                    "role": "assistant",
                    "content": response.get("content") or None
                })
                
                # Check if the model wants to call tools
                if response.get("tool_calls"):
                    for tool_call in response["tool_calls"]:
                        verbose_print(f">>> tool >>> {tool_call['name']}({tool_call['arguments']})")
                        
                        tool_name = tool_call["name"]
                        
                        # Check if the model wants to finish
                        if tool_name == "finish":
                            is_finished = True
                            messages.append({
                                "role": "tool",
                                "content": "Action chain completed."
                            })
                            break
                        
                        # Find the corresponding tool
                        tool = next((t for t in self.tools if t.name == tool_name), None)
                        
                        if tool:
                            try:
                                # Parse the function arguments
                                arguments = json.loads(tool_call["arguments"])
                                
                                # Execute the tool
                                result = await tool.execute(**arguments)
                                
                                # Add the tool result to the conversation
                                messages.append({
                                    "role": "tool",
                                    "content": str(result)
                                })
                            except (json.JSONDecodeError, Exception) as e:
                                # If there's an error, add it as a tool result
                                messages.append({
                                    "role": "tool",
                                    "content": f"Error: {str(e)}"
                                })
                                logger.info(f"Error executing tool {tool_name}: {e}")
                else:
                    verbose_print(f">>> response >>> {response.get('content')}")
                    # If the model generates a response without calling a tool, finish
                    is_finished = True
                    break
                    
            except Exception as e:
                logger.error(f"Error during model interaction: {e}")
                verbose_print(f">>> error >>> {e}")
                break
