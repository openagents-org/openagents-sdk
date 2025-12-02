# Simple Worker Agent - Default Workspace
# A basic Python-based agent that responds to messages

from openagents.agents.worker_agent import WorkerAgent, EventContext, ChannelMessageContext, ReplyMessageContext


class SimpleWorkerAgent(WorkerAgent):

    default_agent_id = "simple-worker"

    async def on_startup(self):
        ws = self.workspace()
        await ws.channel("general").post("Hello from Simple Worker Agent!")

    async def on_direct(self, context: EventContext):
        ws = self.workspace()
        await ws.agent(context.source_id).send(f"Hello {context.source_id}!")

    async def on_channel_post(self, context: ChannelMessageContext):
        ws = self.workspace()
        await ws.channel(context.channel).reply(context.incoming_event.id, f"Hello {context.source_id}!")


if __name__ == "__main__":
    agent = SimpleWorkerAgent()
    agent.start(network_host="localhost", network_port=8700)
    agent.wait_for_stop()
