const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const postsFilePath = path.join(__dirname, '..', 'store', 'posts.json');

const readPostsData = () => {
    try {
        const data = fs.readFileSync(postsFilePath, 'utf8');
        if (!data) {
            return { count: 0, posts: {} };
        }
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return { count: 0, posts: {} };
        }
        console.error('Error reading posts file:', error);
        return { count: 0, posts: {} };
    }
};

const writePostsData = (data) => {
    try {
        fs.writeFileSync(postsFilePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('Error writing posts file:', error);
    }
};

router.post('/save', (req, res) => {
    try {
        const { message, file_id, media_type, buttons } = req.body;

        if (!message && !file_id) {
            return res.status(400).json({ error: 'Post content is empty.' });
        }

        const postsData = readPostsData();
        const newId = postsData.count + 1;

        const parseMode = 'HTML';
        let cleanedMessage = message;
        if (parseMode === 'HTML') {
            cleanedMessage = message.replace(/<p>/g, '').replace(/<\/p>/g, '\n');
            cleanedMessage = cleanedMessage.replace(/ rel="noopener noreferrer"/g, '').replace(/ target="_blank"/g, '');
            cleanedMessage = cleanedMessage.replace(/href="\s*/g, 'href="');
            cleanedMessage = cleanedMessage.trim();
        }

        const newPost = {
            id: newId,
            type: file_id ? media_type : 'text',
            text: cleanedMessage,
            fileId: file_id || null,
            buttons: buttons,
            parseMode: parseMode,
            webPreview: false,
            updatedAt: new Date().toISOString()
        };

        postsData.posts[newId] = newPost;
        postsData.count = newId;

        writePostsData(postsData);

        res.status(201).json({ message: 'Post saved successfully!', post: newPost });
    } catch (error) {
        console.error('Error saving post:', error);
        res.status(500).json({ error: 'Failed to save post.' });
    }
});

router.get('/', (req, res) => {
    try {
        const postsData = readPostsData();
        const postsList = Object.values(postsData.posts)
            .map(post => ({
                id: post.id,
                text: post.text ? post.text.substring(0, 100) + (post.text.length > 100 ? '...' : '') : 'No content',
                updatedAt: post.updatedAt
            }))
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        res.status(200).json(postsList);
    } catch (error) {
        console.error('Error getting posts list:', error);
        res.status(500).json({ error: 'Failed to get posts list.' });
    }
});

router.get('/:id', (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        if (isNaN(postId)) {
            return res.status(400).json({ error: 'Invalid post ID.' });
        }

        const postsData = readPostsData();
        const post = postsData.posts[postId];

        if (!post) {
            return res.status(404).json({ error: `Post with ID ${postId} not found.` });
        }

        res.status(200).json(post);
    } catch (error) {
        console.error('Error getting post by ID:', error);
        res.status(500).json({ error: 'Failed to get post by ID.' });
    }
});

module.exports = router;
