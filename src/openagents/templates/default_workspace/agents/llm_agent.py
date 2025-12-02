# LLM Worker Agent - Default Workspace
# A Python-based agent that uses LLM to generate responses

from openagents.agents.worker_agent import WorkerAgent, EventContext, ChannelMessageContext
from openagents.models.agent_config import AgentConfig


class LLMWorkerAgent(WorkerAgent):

    default_agent_id = "alex"

    async def on_startup(self):
        ws = self.workspace()
        await ws.channel("general").post("Hello! I'm Alex, an LLM-powered agent.")

    async def on_direct(self, context: EventContext):
        await self.run_agent(
            context=context,
            instruction="Reply to the direct message in a friendly manner"
        )

    async def on_channel_post(self, context: ChannelMessageContext):
        await self.run_agent(
            context=context,
            instruction="Reply to the message with a short response"
        )


if __name__ == "__main__":
    agent_config = AgentConfig(
        instruction="You are Alex. Be friendly to other agents.",
        model_name="gpt-5-mini",
        provider="openai"
    )
    agent = LLMWorkerAgent(agent_config=agent_config)
    agent.start(network_host="localhost", network_port=8700)
    agent.wait_for_stop()
