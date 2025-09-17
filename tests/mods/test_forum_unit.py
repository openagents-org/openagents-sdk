"""
Unit tests for the Forum mod without network connectivity.

This test suite validates the forum functionality at the mod level:
- Topic creation, editing, and deletion
- Comment posting with nested threading
- Voting system for topics and comments
- Search and browsing capabilities
"""

import pytest
import asyncio
import logging
import time
from typing import Dict, Any, Optional

from openagents.models.event import Event
from openagents.models.event_response import EventResponse
from openagents.mods.workspace.forum import ForumNetworkMod

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TestForumModUnit:
    """Unit test cases for the Forum mod."""
    
    @pytest.fixture
    def forum_mod(self):
        """Create a forum mod instance."""
        return ForumNetworkMod()
    
    @pytest.mark.asyncio
    async def test_topic_creation(self, forum_mod):
        """Test creating forum topics."""
        # Create a topic creation event
        event = Event(
            event_name="forum.topic.create",
            source_id="test_agent_1",
            payload={
                'title': 'Test Topic',
                'content': 'This is a test topic for the forum.',
                'action': 'create'
            }
        )
        
        # Process the event
        response = await forum_mod.process_event(event)
        
        # Verify response
        assert response is not None
        assert response.success is True
        assert 'topic_id' in response.data
        
        topic_id = response.data['topic_id']
        assert topic_id is not None
        assert isinstance(topic_id, str)
        
        # Verify topic was stored
        assert topic_id in forum_mod.topics
        topic = forum_mod.topics[topic_id]
        assert topic.title == 'Test Topic'
        assert topic.content == 'This is a test topic for the forum.'
        assert topic.owner_id == 'test_agent_1'
        assert topic.comment_count == 0
        assert topic.get_vote_score() == 0
    
    @pytest.mark.asyncio
    async def test_topic_editing(self, forum_mod):
        """Test editing forum topics."""
        # First create a topic
        create_event = Event(
            event_name="forum.topic.create",
            source_id="test_agent_1",
            payload={
                'title': 'Original Title',
                'content': 'Original content.',
                'action': 'create'
            }
        )
        
        create_response = await forum_mod.process_event(create_event)
        topic_id = create_response.data['topic_id']
        
        # Edit the topic
        edit_event = Event(
            event_name="forum.topic.edit",
            source_id="test_agent_1",
            payload={
                'topic_id': topic_id,
                'title': 'Updated Title',
                'content': 'Updated content.',
                'action': 'edit'
            }
        )
        
        response = await forum_mod.process_event(edit_event)
        
        # Verify response
        assert response is not None
        assert response.success is True
        
        # Verify changes
        topic = forum_mod.topics[topic_id]
        assert topic.title == 'Updated Title'
        assert topic.content == 'Updated content.'
    
    @pytest.mark.asyncio
    async def test_topic_editing_by_non_owner(self, forum_mod):
        """Test that non-owners cannot edit topics."""
        # First create a topic
        create_event = Event(
            event_name="forum.topic.create",
            source_id="test_agent_1",
            payload={
                'title': 'Original Title',
                'content': 'Original content.',
                'action': 'create'
            }
        )
        
        create_response = await forum_mod.process_event(create_event)
        topic_id = create_response.data['topic_id']
        
        # Try to edit by different agent
        edit_event = Event(
            event_name="forum.topic.edit",
            source_id="test_agent_2",  # Different agent
            payload={
                'topic_id': topic_id,
                'title': 'Unauthorized Edit',
                'action': 'edit'
            }
        )
        
        response = await forum_mod.process_event(edit_event)
        
        # Verify failure
        assert response is not None
        assert response.success is False
        assert "Only the topic owner can edit" in response.message
    
    @pytest.mark.asyncio
    async def test_comment_posting(self, forum_mod):
        """Test posting comments on topics."""
        # First create a topic
        create_event = Event(
            event_name="forum.topic.create",
            source_id="test_agent_1",
            payload={
                'title': 'Topic for Comments',
                'content': 'This topic will have comments.',
                'action': 'create'
            }
        )
        
        create_response = await forum_mod.process_event(create_event)
        topic_id = create_response.data['topic_id']
        
        # Post a comment
        comment_event = Event(
            event_name="forum.comment.post",
            source_id="test_agent_2",
            payload={
                'topic_id': topic_id,
                'content': 'This is a test comment.',
                'action': 'post'
            }
        )
        
        response = await forum_mod.process_event(comment_event)
        
        # Verify response
        assert response is not None
        assert response.success is True
        assert 'comment_id' in response.data
        
        comment_id = response.data['comment_id']
        
        # Verify comment was stored
        topic = forum_mod.topics[topic_id]
        assert topic.comment_count == 1
        assert comment_id in topic.comments
        
        comment = topic.comments[comment_id]
        assert comment.content == 'This is a test comment.'
        assert comment.author_id == 'test_agent_2'
        assert comment.thread_level == 1
        assert comment.parent_comment_id is None
    
    @pytest.mark.asyncio
    async def test_comment_threading(self, forum_mod):
        """Test nested comment threading."""
        # First create a topic
        create_event = Event(
            event_name="forum.topic.create",
            source_id="test_agent_1",
            payload={
                'title': 'Threading Test',
                'content': 'Testing comment threading.',
                'action': 'create'
            }
        )
        
        create_response = await forum_mod.process_event(create_event)
        topic_id = create_response.data['topic_id']
        
        # Post root comment
        root_comment_event = Event(
            event_name="forum.comment.post",
            source_id="test_agent_1",
            payload={
                'topic_id': topic_id,
                'content': 'Root comment',
                'action': 'post'
            }
        )
        
        root_response = await forum_mod.process_event(root_comment_event)
        root_comment_id = root_response.data['comment_id']
        
        # Post reply to root comment
        reply_event = Event(
            event_name="forum.comment.reply",
            source_id="test_agent_2",
            payload={
                'topic_id': topic_id,
                'content': 'Reply to root',
                'parent_comment_id': root_comment_id,
                'action': 'reply'
            }
        )
        
        reply_response = await forum_mod.process_event(reply_event)
        reply_comment_id = reply_response.data['comment_id']
        
        # Verify threading structure
        topic = forum_mod.topics[topic_id]
        assert topic.comment_count == 2
        
        # Verify root comment
        root_comment = topic.comments[root_comment_id]
        assert root_comment.thread_level == 1
        assert root_comment.parent_comment_id is None
        
        # Verify reply comment
        reply_comment = topic.comments[reply_comment_id]
        assert reply_comment.thread_level == 2
        assert reply_comment.parent_comment_id == root_comment_id
        
        # Verify threading structure
        assert root_comment_id in topic.comment_tree
        assert reply_comment_id in topic.comment_tree[root_comment_id]
    
    @pytest.mark.asyncio
    async def test_voting_on_topic(self, forum_mod):
        """Test voting on topics."""
        # First create a topic
        create_event = Event(
            event_name="forum.topic.create",
            source_id="test_agent_1",
            payload={
                'title': 'Voting Test Topic',
                'content': 'Test voting on this topic.',
                'action': 'create'
            }
        )
        
        create_response = await forum_mod.process_event(create_event)
        topic_id = create_response.data['topic_id']
        
        # Vote on topic
        vote_event = Event(
            event_name="forum.vote.cast",
            source_id="test_agent_2",
            payload={
                'target_type': 'topic',
                'target_id': topic_id,
                'vote_type': 'upvote',
                'action': 'cast'
            }
        )
        
        response = await forum_mod.process_event(vote_event)
        
        # Verify response
        assert response is not None
        assert response.success is True
        assert response.data['upvotes'] == 1
        assert response.data['downvotes'] == 0
        assert response.data['vote_score'] == 1
        
        # Verify topic vote counts
        topic = forum_mod.topics[topic_id]
        assert topic.upvotes == 1
        assert topic.downvotes == 0
        assert topic.get_vote_score() == 1
    
    @pytest.mark.asyncio
    async def test_voting_on_comment(self, forum_mod):
        """Test voting on comments."""
        # First create a topic and comment
        create_event = Event(
            event_name="forum.topic.create",
            source_id="test_agent_1",
            payload={
                'title': 'Topic with Comment',
                'content': 'This topic has a comment.',
                'action': 'create'
            }
        )
        
        create_response = await forum_mod.process_event(create_event)
        topic_id = create_response.data['topic_id']
        
        comment_event = Event(
            event_name="forum.comment.post",
            source_id="test_agent_1",
            payload={
                'topic_id': topic_id,
                'content': 'Comment to vote on',
                'action': 'post'
            }
        )
        
        comment_response = await forum_mod.process_event(comment_event)
        comment_id = comment_response.data['comment_id']
        
        # Vote on comment
        vote_event = Event(
            event_name="forum.vote.cast",
            source_id="test_agent_2",
            payload={
                'target_type': 'comment',
                'target_id': comment_id,
                'vote_type': 'downvote',
                'action': 'cast'
            }
        )
        
        response = await forum_mod.process_event(vote_event)
        
        # Verify response
        assert response is not None
        assert response.success is True
        assert response.data['upvotes'] == 0
        assert response.data['downvotes'] == 1
        assert response.data['vote_score'] == -1
        
        # Verify comment vote counts
        topic = forum_mod.topics[topic_id]
        comment = topic.comments[comment_id]
        assert comment.upvotes == 0
        assert comment.downvotes == 1
        assert comment.get_vote_score() == -1
    
    @pytest.mark.asyncio
    async def test_topic_listing(self, forum_mod):
        """Test listing forum topics."""
        # Create multiple topics
        topic_ids = []
        for i in range(3):
            create_event = Event(
                event_name="forum.topic.create",
                source_id="test_agent_1",
                payload={
                    'title': f'Topic {i+1}',
                    'content': f'Content for topic {i+1}',
                    'action': 'create'
                }
            )
            
            response = await forum_mod.process_event(create_event)
            topic_ids.append(response.data['topic_id'])
            
            # Small delay to ensure different timestamps
            await asyncio.sleep(0.01)
        
        # List topics
        list_event = Event(
            event_name="forum.topics.list",
            source_id="test_agent_2",
            payload={
                'query_type': 'list_topics',
                'limit': 10,
                'offset': 0,
                'sort_by': 'recent'
            }
        )
        
        response = await forum_mod.process_event(list_event)
        
        # Verify response
        assert response is not None
        assert response.success is True
        assert len(response.data['topics']) == 3
        assert response.data['total_count'] == 3
        assert response.data['has_more'] is False
        
        # Verify topics are sorted by recency (newest first)
        topics = response.data['topics']
        assert topics[0]['title'] == 'Topic 3'
        assert topics[1]['title'] == 'Topic 2'
        assert topics[2]['title'] == 'Topic 1'
    
    @pytest.mark.asyncio
    async def test_topic_search(self, forum_mod):
        """Test searching forum topics."""
        # Create topics with different content
        topics_data = [
            ('Python Programming', 'Discussion about Python programming language'),
            ('JavaScript Frameworks', 'Comparing different JavaScript frameworks'),
            ('Machine Learning with Python', 'Using Python for machine learning projects')
        ]
        
        for title, content in topics_data:
            create_event = Event(
                event_name="forum.topic.create",
                source_id="test_agent_1",
                payload={
                    'title': title,
                    'content': content,
                    'action': 'create'
                }
            )
            await forum_mod.process_event(create_event)
        
        # Search for Python topics
        search_event = Event(
            event_name="forum.topics.search",
            source_id="test_agent_1",
            payload={
                'query_type': 'search_topics',
                'query': 'Python',
                'limit': 50,
                'offset': 0
            }
        )
        
        response = await forum_mod.process_event(search_event)
        
        # Verify response
        assert response is not None
        assert response.success is True
        assert len(response.data['topics']) == 2
        assert response.data['total_count'] == 2
        
        # Verify search results contain Python topics
        titles = [topic['title'] for topic in response.data['topics']]
        assert 'Python Programming' in titles
        assert 'Machine Learning with Python' in titles
        assert 'JavaScript Frameworks' not in titles
    
    @pytest.mark.asyncio
    async def test_get_topic_with_comments(self, forum_mod):
        """Test getting a topic with all its comments."""
        # Create a topic
        create_event = Event(
            event_name="forum.topic.create",
            source_id="test_agent_1",
            payload={
                'title': 'Topic with Comments',
                'content': 'This topic will have comments.',
                'action': 'create'
            }
        )
        
        create_response = await forum_mod.process_event(create_event)
        topic_id = create_response.data['topic_id']
        
        # Add some comments
        comment_event = Event(
            event_name="forum.comment.post",
            source_id="test_agent_2",
            payload={
                'topic_id': topic_id,
                'content': 'First comment',
                'action': 'post'
            }
        )
        
        await forum_mod.process_event(comment_event)
        
        # Get topic with comments
        get_event = Event(
            event_name="forum.topic.get",
            source_id="test_agent_1",
            payload={
                'query_type': 'get_topic',
                'topic_id': topic_id
            }
        )
        
        response = await forum_mod.process_event(get_event)
        
        # Verify response
        assert response is not None
        assert response.success is True
        
        topic_data = response.data
        assert topic_data['title'] == 'Topic with Comments'
        assert topic_data['comment_count'] == 1
        assert len(topic_data['comments']) == 1
        assert topic_data['comments'][0]['content'] == 'First comment'
    
    @pytest.mark.asyncio
    async def test_error_handling(self, forum_mod):
        """Test error handling in forum operations."""
        # Test creating topic with empty title
        event = Event(
            event_name="forum.topic.create",
            source_id="test_agent_1",
            payload={
                'title': '',
                'content': 'Content',
                'action': 'create'
            }
        )
        
        response = await forum_mod.process_event(event)
        assert response is not None
        assert response.success is False
        assert "title cannot be empty" in response.message
        
        # Test editing non-existent topic
        event = Event(
            event_name="forum.topic.edit",
            source_id="test_agent_1",
            payload={
                'topic_id': 'non_existent_id',
                'title': 'New Title',
                'action': 'edit'
            }
        )
        
        response = await forum_mod.process_event(event)
        assert response is not None
        assert response.success is False
        assert "Topic not found" in response.message
        
        # Test commenting on non-existent topic
        event = Event(
            event_name="forum.comment.post",
            source_id="test_agent_1",
            payload={
                'topic_id': 'non_existent_id',
                'content': 'Comment',
                'action': 'post'
            }
        )
        
        response = await forum_mod.process_event(event)
        assert response is not None
        assert response.success is False
        assert "Topic not found" in response.message

if __name__ == "__main__":
    # Run a simple test
    async def run_basic_test():
        """Run a basic test to verify the forum mod works."""
        logger.info("Starting basic forum mod unit test...")
        
        forum_mod = ForumNetworkMod()
        
        try:
            # Test topic creation
            logger.info("Testing topic creation...")
            event = Event(
                event_name="forum.topic.create",
                source_id="test_agent",
                payload={
                    'title': 'Test Topic',
                    'content': 'This is a test topic.',
                    'action': 'create'
                }
            )
            
            response = await forum_mod.process_event(event)
            topic_id = response.data['topic_id']
            logger.info(f"Created topic: {topic_id}")
            
            # Test comment posting
            logger.info("Testing comment posting...")
            comment_event = Event(
                event_name="forum.comment.post",
                source_id="test_agent",
                payload={
                    'topic_id': topic_id,
                    'content': 'This is a test comment.',
                    'action': 'post'
                }
            )
            
            comment_response = await forum_mod.process_event(comment_event)
            comment_id = comment_response.data['comment_id']
            logger.info(f"Posted comment: {comment_id}")
            
            # Test voting
            logger.info("Testing voting...")
            vote_event = Event(
                event_name="forum.vote.cast",
                source_id="test_agent",
                payload={
                    'target_type': 'topic',
                    'target_id': topic_id,
                    'vote_type': 'upvote',
                    'action': 'cast'
                }
            )
            
            vote_response = await forum_mod.process_event(vote_event)
            logger.info(f"Vote cast: {vote_response.success}")
            
            # Test topic listing
            logger.info("Testing topic listing...")
            list_event = Event(
                event_name="forum.topics.list",
                source_id="test_agent",
                payload={
                    'query_type': 'list_topics',
                    'limit': 10,
                    'offset': 0,
                    'sort_by': 'recent'
                }
            )
            
            list_response = await forum_mod.process_event(list_event)
            logger.info(f"Listed {len(list_response.data['topics'])} topics")
            
            logger.info("Basic forum mod unit test completed successfully!")
            
        except Exception as e:
            logger.error(f"Test failed: {e}")
            raise
    
    # Run the basic test
    asyncio.run(run_basic_test())

