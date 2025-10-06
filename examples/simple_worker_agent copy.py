from openagents.agents.worker_agent import WorkerAgent, EventContext, ChannelMessageContext
from openagents.models.agent_config import AgentConfig

class SimpleWorkerAgent(WorkerAgent):
    
    default_agent_id = "charlie"

    async def on_startup(self):
        ws = self.workspace()
        await ws.channel("general").post("Hello from Simple Worker Agent!")

    async def on_direct(self, context: EventContext): 
        ws = self.workspace()
        await ws.agent(context.source_id).send(f"Hello {context.source_id}!")
    
    async def on_channel_post(self, context: ChannelMessageContext):
        self.run_agent(
            context=context,
            instruction="Reply to the message with a short response"
        )

if __name__ == "__main__":
    agent_config = AgentConfig(
        model_name="gpt-4o-mini",
        provider="openai",
        api_base="https://api.openai.com/v1"
    )
    agent = SimpleWorkerAgent()
    agent.start(network_host="localhost", network_port=8700)
    agent.wait_for_stop()