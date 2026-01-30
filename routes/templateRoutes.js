const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const templatesFilePath = path.join(__dirname, '..', 'store', 'templates.json');

const readTemplatesData = () => {
    try {
        if (!fs.existsSync(templatesFilePath)) {
            return { count: 0, templates: {} };
        }
        const data = fs.readFileSync(templatesFilePath, 'utf8');
        if (!data) {
            return { count: 0, templates: {} };
        }
        const parsedData = JSON.parse(data);
        if (typeof parsedData === 'object' && parsedData !== null && parsedData.templates) {
            return parsedData;
        } else {
            return { count: 0, templates: {} };
        }
    } catch (error) {
        console.error('Error reading templates file, resetting to default:', error);
        return { count: 0, templates: {} };
    }
};

const writeTemplatesData = (data) => {
    try {
        fs.writeFileSync(templatesFilePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('Error writing templates file:', error);
    }
};

router.post('/', (req, res) => {
    try {
        const { name, message, file_id, media_type, buttons } = req.body;

        if (!name || (!message && !file_id)) {
            return res.status(400).json({ error: 'Template name and content cannot be empty.' });
        }

        const templatesData = readTemplatesData();
        const templateName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');

        if (templatesData.templates[templateName]) {
            return res.status(409).json({ error: `Template with name '${name}' already exists.` });
        }

        const parseMode = 'HTML';
        let cleanedMessage = message;
        if (parseMode === 'HTML') {
            cleanedMessage = message.replace(/<p>/g, '').replace(/<\/p>/g, '\n');
            cleanedMessage = cleanedMessage.replace(/ rel="noopener noreferrer"/g, '').replace(/ target="_blank"/g, '');
            cleanedMessage = cleanedMessage.replace(/href="\s*/g, 'href="');
            cleanedMessage = cleanedMessage.trim();
        }

        const newTemplate = {
            name: name,
            type: file_id ? media_type : 'text',
            text: cleanedMessage,
            fileId: file_id || null,
            buttons: buttons,
            parseMode: parseMode,
            webPreview: false,
            createdAt: new Date().toISOString()
        };

        templatesData.templates[templateName] = newTemplate;
        templatesData.count = (templatesData.count || 0) + 1;
        writeTemplatesData(templatesData);

        res.status(201).json({ message: 'Template saved successfully!', template: newTemplate });
    } catch (error) {
        console.error('Error saving template:', error);
        res.status(500).json({ error: 'Failed to save template.' });
    }
});

router.get('/', (req, res) => {
    try {
        const templatesData = readTemplatesData();
        const templatesList = Object.values(templatesData.templates)
            .map(template => ({
                name: template.name,
                text: template.text ? template.text.substring(0, 100) + (template.text.length > 100 ? '...' : '') : 'No content',
                createdAt: template.createdAt
            }))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.status(200).json(templatesList);
    } catch (error) {
        console.error('Error getting templates list:', error);
        res.status(500).json({ error: 'Failed to get templates list.' });
    }
});

router.get('/:name', (req, res) => {
    try {
        const templateName = req.params.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const templatesData = readTemplatesData();
        const template = templatesData.templates[templateName];

        if (!template) {
            return res.status(404).json({ error: `Template with name '${req.params.name}' not found.` });
        }

        res.status(200).json(template);
    } catch (error) {
        console.error('Error getting template by name:', error);
        res.status(500).json({ error: 'Failed to get template by name.' });
    }
});

module.exports = router;
