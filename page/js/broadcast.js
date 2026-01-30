if (!window.quillBlotsRegistered) {
    try {
        const Inline = Quill.import('blots/inline');

        class SpoilerBlot extends Inline { }
        SpoilerBlot.blotName = 'spoiler';
        SpoilerBlot.tagName = 'tg-spoiler';
        Quill.register(SpoilerBlot);

        class InlineMonoBlot extends Inline { }
        InlineMonoBlot.blotName = 'inlinemono';
        InlineMonoBlot.tagName = 'code';
        Quill.register(InlineMonoBlot);

        window.quillBlotsRegistered = true;
    } catch (e) {
        console.warn("Could not register Quill blots. They may already be registered.", e);
    }
}

window.initBroadcast = function () {

    // --- Quill Setup ---
    const quill = new Quill('#broadcast-editor', {
        theme: 'snow',
        modules: {
            toolbar: {
                container: '#broadcast-toolbar',
                handlers: {
                    'spoiler': () => quill.format('spoiler', !quill.getFormat().spoiler),
                    'code-block': () => quill.format('inlinemono', !quill.getFormat().inlinemono)
                }
            }
        }
    });

    const editor = document.querySelector('#broadcast-editor .ql-editor');
    if (editor) {
        editor.addEventListener('click', (event) => {
            if (event.target.tagName === 'TG-SPOILER') {
                event.target.classList.toggle('revealed');
            }
        });
    }

    function initializeButtonEditor() {
        // --- DOM Elements ---
        const getElements = (ids) => {
            const elements = {};
            ids.forEach(id => {
                elements[id.replace(/-/g, '_')] = document.getElementById(id);
            });
            return elements;
        };

        const {
            send_broadcast_btn: sendBtn,
            send_test_btn: sendTestBtn,
            save_post_btn: savePostBtn,
            broadcast_status: statusEl,
            media_file_input: mediaFileInput,
            media_file_name: mediaFileNameEl,
            media_preview: mediaPreviewEl,
            media_file_id: mediaFileIdInput,
            media_url_input_field: mediaUrlInputField,
            attach_url_btn: attachUrlBtn,
            media_url_input: mediaUrlInput,
            media_type: mediaTypeInput,
            button_rows_container: buttonRowsContainer,
            add_row_btn: addRowBtn,
            broadcast_buttons_input: buttonsInput,
            bulk_add_btn: bulkAddBtn,
            bulk_add_modal: bulkAddModal,
            cancel_bulk_add: cancelBulkAddBtn,
            confirm_bulk_add: confirmBulkAddBtn,
            bulk_add_textarea: bulkAddTextarea,
            load_btn: loadBtn,
            load_modal: loadModal,
            load_tabs: loadTabs,
            load_search: loadSearch,
            load_list: loadList,
            cancel_load: cancelLoadBtn,
            confirm_load: confirmLoadBtn,
            save_template_btn: saveTemplateBtn,
            save_template_modal: saveTemplateModal,
            template_name_input: templateNameInput,
            cancel_save_template: cancelSaveTemplateBtn,
            confirm_save_template: confirmSaveTemplateBtn,
            send_test_modal: sendTestModal,
            cancel_send_test: cancelSendTestBtn,
            confirm_send_test: confirmSendTestBtn,
            test_recipients_input: testRecipientsInput
        } = getElements([
            'send-broadcast-btn', 'send-test-btn', 'save-post-btn', 'broadcast-status',
            'media-file-input', 'media-file-name', 'media-preview', 'media-file-id',
            'media-url-input-field', 'attach-url-btn', 'media-url-input', 'media-type',
            'button-rows-container', 'add-row-btn', 'broadcast-buttons-input', 'bulk-add-btn',
            'bulk-add-modal', 'cancel-bulk-add', 'confirm-bulk-add', 'bulk-add-textarea',
            'load-btn', 'load-modal', 'load-tabs', 'load-search', 'load-list',
            'cancel-load', 'confirm-load', 'save-template-btn',
            'save-template-modal', 'template-name-input', 'cancel-save-template', 'confirm-save-template',
            'send-test-modal', 'cancel-send-test', 'confirm-send-test', 'test-recipients-input'
        ]);


        // --- State ---
        let buttonRows = [];
        let allPosts = [];
        let allTemplates = [];
        let selectedItem = null;
        let currentTab = 'posts';


        const modalManager = {
            open: (modal) => {
                modal.classList.remove('hidden');
                modal.classList.add('flex');
            },
            close: (modal, inputsToClear = [], confirmBtn = null) => {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
                if (Array.isArray(inputsToClear)) {
                    inputsToClear.forEach(input => input.value = '');
                }
                if (confirmBtn) {
                    confirmBtn.disabled = true;
                    confirmBtn.classList.add('opacity-50', 'cursor-not-allowed');
                }
            }
        };

        // --- Functions ---
        function getEditorData() {
            updateButtonsInput();
            const buttonsJson = buttonsInput.value;
            let buttons = [];
            try {
                buttons = JSON.parse(buttonsJson);
            } catch (e) {
                console.error("Error parsing buttons JSON", e);
            }

            return {
                message: quill.getSemanticHTML(),
                file_id: mediaFileIdInput.value,
                media_type: mediaTypeInput.value,
                media_url: mediaUrlInput.value,
                buttons: buttons,
            };
        }

        async function apiCall(endpoint, data, loadingMessage, buttonToDisable) {
            statusEl.textContent = loadingMessage;
            if(buttonToDisable) buttonToDisable.disabled = true;

            try {
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                if (!res.ok) {
                    let errorMsg = `Request failed: ${res.statusText}`;
                    try {
                        const errorData = await res.json();
                        if (errorData && errorData.error) {
                            errorMsg = errorData.error;
                        }
                    } catch (e) { /* Ignore parsing error */ }
                    throw new Error(errorMsg);
                }

                const result = await res.json();
                showToast(result.message, 'success');
                statusEl.textContent = result.message;
                return result;
            } catch (error) {
                console.error(`Error with ${endpoint}:`, error);
                showToast(error.message, 'error');
                statusEl.textContent = `Error: ${error.message}`;
                return null;
            } finally {
                if(buttonToDisable) buttonToDisable.disabled = false;
            }
        }

        function loadPostIntoEditor(post) {

            quill.setText('');
            // Convert newlines to <br> and paste as HTML
            const html = post.text.replace(/\n/g, '<br>');
            quill.clipboard.dangerouslyPasteHTML(0, html);

            // Clear and set media
            mediaFileInput.value = '';
            mediaFileNameEl.textContent = 'No file chosen';
            mediaPreviewEl.innerHTML = '';
            mediaFileIdInput.value = '';
            mediaTypeInput.value = '';

            if (post.fileId) {
                mediaFileIdInput.value = post.fileId;
                mediaTypeInput.value = post.type;
                mediaFileNameEl.textContent = `Attached: ${post.fileId}`;
                if (post.type === 'photo') {
                    mediaPreviewEl.innerHTML = `<div class="p-4 bg-gray-700 rounded-lg text-white"><p><b>Type:</b> Photo</p><p><b>File ID:</b> ${post.fileId}</p><p>Media preview not available for loaded posts.</p></div>`;
                } else if (post.type === 'video') {
                    mediaPreviewEl.innerHTML = `<div class="p-4 bg-gray-700 rounded-lg text-white"><p><b>Type:</b> Video</p><p><b>File ID:</b> ${post.fileId}</p><p>Media preview not available for loaded posts.</p></div>`;
                } else if (post.type === 'document') {
                    mediaPreviewEl.innerHTML = `<div class="p-4 bg-gray-700 rounded-lg text-white"><p><b>Type:</b> Document</p><p><b>File ID:</b> ${post.fileId}</p><p>Media preview not available for loaded posts.</p></div>`;
                } else {
                    mediaPreviewEl.innerHTML = `<div class="p-4 bg-gray-700 rounded-lg text-white"><p><b>Type:</b> ${post.type}</p><p><b>File ID:</b> ${post.fileId}</p><p>Media preview not available for loaded posts.</p></div>`;
                }
            }

            // Set buttons
            buttonRows = post.buttons || [[]];
            renderButtonRows();
            updateButtonsInput();

            showToast(`Post #${post.id} loaded successfully!`, 'success');
        }
        /**
         * Fetches posts from the backend and renders them in the Load Post modal.
         * Optionally filters posts by a search term.
         * @param {string} searchTerm - Optional term to filter posts by ID or text content.
         */
        async function fetchAndRender() {
            const endpoint = currentTab === 'posts' ? '/api/posts' : '/api/templates';
            const dataCache = currentTab === 'posts' ? allPosts : allTemplates;
            
            loadList.innerHTML = '<div class="text-gray-400 text-center py-4">Loading...</div>';
            confirmLoadBtn.disabled = true;
            confirmLoadBtn.classList.add('opacity-50', 'cursor-not-allowed');
            selectedItem = null;

            try {
                if (dataCache.length === 0) {
                    const res = await fetch(endpoint);
                    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                    const jsonData = await res.json();
                    if (currentTab === 'posts') allPosts = jsonData;
                    else allTemplates = jsonData;
                }
                
                const currentData = currentTab === 'posts' ? allPosts : allTemplates;
                const searchTerm = loadSearch.value.toLowerCase();
                const filteredData = searchTerm
                    ? currentData.filter(item => 
                        (item.text && item.text.toLowerCase().includes(searchTerm)) || 
                        (item.name && item.name.toLowerCase().includes(searchTerm)) || 
                        (item.id && item.id.toString().includes(searchTerm)))
                    : currentData;

                loadList.innerHTML = '';
                if (filteredData.length === 0) {
                    loadList.innerHTML = '<div class="text-gray-400 text-center py-4">No items found.</div>';
                    return;
                }

                filteredData.forEach(item => {
                    loadList.appendChild(renderItem(item));
                });

            } catch (error) {
                console.error(`Error fetching from ${endpoint}:`, error);
                loadList.innerHTML = `<div class="text-red-400 text-center py-4">Error loading data: ${error.message}</div>`;
            }
        }

        function renderItem(item) {
            const itemEl = document.createElement('div');
            itemEl.className = 'load-item bg-gray-800 hover:bg-gray-700 rounded-lg p-3 cursor-pointer transition-colors border border-gray-700';
            
            if (currentTab === 'posts') {
                itemEl.dataset.itemId = item.id;
                itemEl.innerHTML = `
                    <h4 class="text-white font-medium">Post #${item.id}</h4>
                    <p class="text-gray-400 text-sm mt-1 truncate">${item.text || 'No content'}</p>
                    <p class="text-gray-500 text-xs mt-1">Last Updated: ${new Date(item.updatedAt).toLocaleString()}</p>
                `;
            } else {
                itemEl.dataset.itemId = item.name;
                itemEl.innerHTML = `
                    <h4 class="text-white font-medium">Template: ${item.name}</h4>
                    <p class="text-gray-400 text-sm mt-1 truncate">${item.text || 'No content'}</p>
                    <p class="text-gray-500 text-xs mt-1">Created At: ${new Date(item.createdAt).toLocaleString()}</p>
                `;
            }
            return itemEl;
        }

        function parseBulkButtons(text) {
            if (!text) return [];
            return text.split('\n')
                .map(line => line.trim())
                .filter(line => line)
                .map(line => {
                    return line.split('+')
                        .map(part => {
                            const btnParts = part.split('=').map(p => p.trim());
                            if (btnParts.length < 2 || !btnParts[0] || !btnParts[1]) return null;

                            const btnText = btnParts[0];
                            let btnUrl = btnParts.slice(1).join('=').trim();

                            if (btnUrl && !btnUrl.startsWith('http://') && !btnUrl.startsWith('https://')) {
                                btnUrl = 'https://' + btnUrl;
                            }

                            return { text: btnText, url: btnUrl };
                        })
                        .filter(btn => btn !== null);
                })
                .filter(row => row.length > 0);
        }
        function updateButtonsInput() {
            const validButtons = buttonRows
                .map(row => row.filter(btn => btn.text.trim() && btn.url.trim()))
                .filter(row => row.length > 0);
            buttonsInput.value = JSON.stringify(validButtons);
        }

        function renderButtonRows() {
            if (!buttonRowsContainer) return;
            buttonRowsContainer.innerHTML = '';

            buttonRows.forEach((row, rowIndex) => {
                const rowEl = document.createElement('div');
                rowEl.className = 'button-row-card relative group';
                rowEl.dataset.rowIndex = rowIndex;

                const header = document.createElement('div');
                header.className = 'flex items-center justify-between mb-3';
                header.innerHTML = `
                    <div class="flex items-center gap-2">
                        <span class="text-sm font-medium text-gray-400">Row ${rowIndex + 1}</span>
                    </div>
                    <button data-action="delete-row" data-row-index="${rowIndex}" class="text-gray-500 hover:text-red-400 transition-colors p-1" title="Delete Row">
                        <svg class="pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                `;
                rowEl.appendChild(header);

                const buttonsList = document.createElement('div');
                buttonsList.className = 'buttons-list flex flex-wrap items-center gap-3 min-h-[50px]';
                buttonsList.dataset.rowIndex = rowIndex;

                row.forEach((btn, btnIndex) => {
                    const btnEl = document.createElement('div');
                    btnEl.className = 'button-item group/btn relative';
                    btnEl.dataset.btnIndex = btnIndex;
                    btnEl.innerHTML = `
                        <button type="button" data-action="delete-button" data-row-index="${rowIndex}" data-btn-index="${btnIndex}" class="absolute -top-2 -right-2 opacity-0 group-hover/btn:opacity-100 transition-opacity z-10 bg-gray-800 text-gray-400 hover:text-red-400 rounded-full p-1 border border-gray-600 shadow-sm">
                            <svg class="pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                        <div class="space-y-2">
                            <input type="text" data-field="text" data-row-index="${rowIndex}" data-btn-index="${btnIndex}" class="btn-text-input w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none" value="${btn.text}" placeholder="Button Text">
                            <input type="text" data-field="url" data-row-index="${rowIndex}" data-btn-index="${btnIndex}" class="btn-url-input w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none" value="${btn.url}" placeholder="https://...">
                        </div>
                    `;
                    buttonsList.appendChild(btnEl);
                });

                const addBtnBtn = document.createElement('button');
                addBtnBtn.type = 'button';
                addBtnBtn.dataset.action = 'add-button';
                addBtnBtn.dataset.rowIndex = rowIndex;
                addBtnBtn.className = 'flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg border-2 border-dashed border-gray-600 text-gray-500 hover:text-white hover:border-gray-400 transition-colors';
                addBtnBtn.title = "Add Button to Row";
                addBtnBtn.innerHTML = `<svg class="pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;

                buttonsList.appendChild(addBtnBtn);
                rowEl.appendChild(buttonsList);
                buttonRowsContainer.appendChild(rowEl);
            });
        }


        async function uploadMedia() {
            const file = mediaFileInput.files[0];
            if (!file) return;

            mediaUrlInputField.value = '';
            mediaUrlInput.value = '';

            mediaFileNameEl.textContent = 'Uploading...';
            const formData = new FormData();
            formData.append('media', file);
            try {
                const res = await fetch('/api/broadcast/upload', { method: 'POST', body: formData });
                if (!res.ok) {
                    let errorMsg = 'Upload failed';
                    try {
                        const errorData = await res.json();
                        if (errorData && errorData.error) {
                            errorMsg = errorData.error;
                        } else {
                            errorMsg = res.statusText;
                        }
                    } catch (e) {
                        errorMsg = res.statusText;
                    }
                    throw new Error(errorMsg);
                }
                const data = await res.json();
                mediaFileIdInput.value = data.file_id;
                mediaTypeInput.value = data.media_type;
                mediaFileNameEl.textContent = data.file_name;
                mediaPreviewEl.innerHTML = data.media_type === 'photo'
                    ? `<img src="${URL.createObjectURL(file)}" class="max-w-xs max-h-48 rounded-lg mt-2">`
                    : `<div class="p-4 bg-gray-700 rounded-lg text-white"><p><b>Type:</b> ${data.media_type}</p><p><b>File:</b> ${data.file_name}</p></div>`;
                showToast('Media attached successfully!', 'success');
            } catch (error) {
                console.error('Error uploading media:', error);
                showToast(error.message, 'error');
                mediaFileNameEl.textContent = 'Upload failed.';
            }
        }

        function attachMediaFromUrl() {
            const url = mediaUrlInputField.value.trim();
            if (!url) {
                return showToast('Please enter a valid URL.', 'info');
            }

            mediaFileInput.value = '';
            mediaFileIdInput.value = '';

            mediaUrlInput.value = url;
            mediaFileNameEl.textContent = `URL: ${url.substring(0, 50)}...`;

            if (url.match(/\.(jpeg|jpg|gif|png)$/i)) {
                mediaTypeInput.value = 'photo';
                mediaPreviewEl.innerHTML = `<img src="${url}" class="max-w-xs max-h-48 rounded-lg mt-2">`;
            } else if (url.match(/\.(mp4|mov)$/i)) {
                mediaTypeInput.value = 'video';
                mediaPreviewEl.innerHTML = `<video controls src="${url}" class="max-w-xs max-h-48 rounded-lg mt-2"></video>`;
            } else {
                mediaTypeInput.value = 'auto';
                mediaPreviewEl.innerHTML = `<div class="p-4 bg-gray-700 rounded-lg text-white"><p><b>URL Attached:</b></p><p class="truncate">${url}</p><p class="text-sm mt-2 text-gray-400">Preview not available for this URL type.</p></div>`;
            }
            showToast('Media URL attached successfully!', 'success');
        }

        function sendBroadcast() {
            const broadcastData = getEditorData();
            if (quill.getLength() <= 1 && !broadcastData.file_id && !broadcastData.media_url) {
                return showToast('Cannot send an empty message without media.', 'info');
            }

            showConfirmationModal('Are you sure you want to send this broadcast?', async () => {
                const result = await apiCall('/api/broadcast', broadcastData, 'Starting broadcast...', sendBtn);
                if (result) {
                    quill.setText('');
                    mediaFileInput.value = '';
                    mediaUrlInputField.value = '';
                    mediaUrlInput.value = '';
                    mediaFileNameEl.textContent = 'No file chosen';
                    mediaPreviewEl.innerHTML = '';
                    mediaFileIdInput.value = '';
                    mediaTypeInput.value = '';
                    buttonRows = [];
                    renderButtonRows();
                    updateButtonsInput();
                }
            });
        }


        function sendTestMessage() {
            modalManager.open(sendTestModal);
            // pre-fill with common test recipients
            testRecipientsInput.value = '-1002338947452, @animedrive2, @mangadwnld';
        }

        async function confirmSendTestMessage() {
            const testData = getEditorData();
            const recipientsInput = testRecipientsInput.value.trim();

            if (quill.getLength() <= 1 && !testData.file_id && !testData.media_url) {
                return showToast('Cannot send an empty message without media for testing.', 'info');
            }
            
            testData.recipients = recipientsInput ? recipientsInput.split(',').map(item => item.trim()).filter(item => item) : [];

            showConfirmationModal('Are you sure you want to send this as a test message?', async () => {
                const result = await apiCall('/api/broadcast/test', testData, 'Sending test message...', confirmSendTestBtn);
                if (result) {
                    modalManager.close(sendTestModal, [testRecipientsInput]);
                }
            });
        }
        
        function savePost() {
            const postData = getEditorData();
            if (quill.getLength() <= 1 && !postData.file_id && !postData.media_url) {
                return showToast('Cannot save an empty post.', 'info');
            }

            showConfirmationModal('Are you sure you want to save this post?', async () => {
                await apiCall('/api/posts/save', postData, 'Saving post...', savePostBtn);
            });
        }

        
        /**
         * Saves the current editor content as a new template.
         */
        async function saveAsTemplate() {
            const templateName = templateNameInput.value;
            if (!templateName) {
                return showToast('Template name cannot be empty.', 'info');
            }

            const templateData = getEditorData();
            if (quill.getLength() <= 1 && !templateData.file_id && !templateData.media_url) {
                return showToast('Template content is empty.', 'info');
            }

            templateData.name = templateName;

            const result = await apiCall('/api/templates', templateData, 'Saving template...', confirmSaveTemplateBtn);
            if(result){
                modalManager.close(saveTemplateModal, [templateNameInput]);
            }
        }

        /**
         * Fetches templates from the backend and renders them in the Load Template modal.
         * Optionally filters templates by a search term.
         * @param {string} searchTerm - Optional term to filter templates by name or text content.
         */
        // --- Event Listeners ---
        [
            [sendBtn, 'click', sendBroadcast],
            [sendTestBtn, 'click', () => modalManager.open(sendTestModal)],
            [cancelSendTestBtn, 'click', () => modalManager.close(sendTestModal, [testRecipientsInput])],
            [confirmSendTestBtn, 'click', confirmSendTestMessage],
            [savePostBtn, 'click', savePost],
            [mediaFileInput, 'change', uploadMedia],
            [attachUrlBtn, 'click', attachMediaFromUrl],
            [addRowBtn, 'click', () => {
                buttonRows.push([]);
                renderButtonRows();
                updateButtonsInput();
            }],
            [bulkAddBtn, 'click', () => modalManager.open(bulkAddModal)],
            [cancelBulkAddBtn, 'click', () => modalManager.close(bulkAddModal, [bulkAddTextarea])],
            [confirmBulkAddBtn, 'click', () => {
                const text = bulkAddTextarea.value;
                const newButtons = parseBulkButtons(text);
                if (newButtons.length > 0) {
                    buttonRows.push(...newButtons);
                    renderButtonRows();
                    updateButtonsInput();
                }
                modalManager.close(bulkAddModal, [bulkAddTextarea]);
            }],
            [loadBtn, 'click', () => {
                modalManager.open(loadModal);
                fetchAndRender();
            }],
            [cancelLoadBtn, 'click', () => modalManager.close(loadModal, [loadSearch], confirmLoadBtn)],
            [loadSearch, 'input', fetchAndRender],
            [confirmLoadBtn, 'click', () => confirmLoadHandler()],
            [saveTemplateBtn, 'click', () => modalManager.open(saveTemplateModal)],
            [cancelSaveTemplateBtn, 'click', () => modalManager.close(saveTemplateModal, [templateNameInput])],
            [confirmSaveTemplateBtn, 'click', saveAsTemplate]
        ].forEach(([element, event, handler]) => {
            if (element) {
                element.addEventListener(event, handler);
            }
        });

        loadTabs.addEventListener('click', (e) => {
            const tab = e.target.closest('.load-tab-btn');
            if (tab) {
                currentTab = tab.dataset.tab;
                loadTabs.querySelectorAll('.load-tab-btn').forEach(t => t.classList.remove('border-primary', 'text-white'));
                tab.classList.add('border-primary', 'text-white');
                fetchAndRender();
            }
        });

        loadList.addEventListener('click', (e) => {
            const itemEl = e.target.closest('.load-item');
            if (itemEl) {
                loadList.querySelectorAll('.load-item').forEach(item => {
                    item.classList.remove('border-blue-500', 'bg-blue-900');
                });
                itemEl.classList.add('border-blue-500', 'bg-blue-900');
                selectedItem = {
                    id: itemEl.dataset.itemId,
                    type: currentTab
                };
                confirmLoadBtn.disabled = false;
                confirmLoadBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        });


        async function confirmLoadHandler() {
            if (selectedItem) {
                const endpoint = selectedItem.type === 'posts' ? `/api/posts/${selectedItem.id}` : `/api/templates/${selectedItem.id}`;
                try {
                    const res = await fetch(endpoint);
                    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                    const data = await res.json();
                    loadPostIntoEditor(data);
                    modalManager.close(loadModal, [loadSearch], confirmLoadBtn);
                    selectedItem = null;
                } catch (error) {
                    console.error('Error loading item:', error);
                    showToast(`Failed to load item: ${error.message}`, 'error');
                }
            }
        }


        if (buttonRowsContainer) {
            buttonRowsContainer.addEventListener('click', (e) => {
                const target = e.target.closest('[data-action]');
                if (!target) return;

                const action = target.dataset.action;
                const rowIndex = parseInt(target.dataset.rowIndex);

                if (action === 'delete-row') {
                    buttonRows.splice(rowIndex, 1);
                    renderButtonRows();
                    updateButtonsInput();
                } else if (action === 'add-button') {
                    buttonRows[rowIndex].push({ text: '', url: '' });
                    renderButtonRows();
                    updateButtonsInput();
                } else if (action === 'delete-button') {
                    const btnIndex = parseInt(target.dataset.btnIndex);
                    buttonRows[rowIndex].splice(btnIndex, 1);
                    renderButtonRows();
                    updateButtonsInput();
                }
            });

            buttonRowsContainer.addEventListener('input', (e) => {
                const target = e.target.closest('[data-field]');
                if (!target) return;

                const field = target.dataset.field;
                const rowIndex = parseInt(target.dataset.rowIndex);
                const btnIndex = parseInt(target.dataset.btnIndex);

                buttonRows[rowIndex][btnIndex][field] = e.target.value;
                updateButtonsInput();
            });
        }

        // Initial Render
        renderButtonRows();

        if (bulkAddBtn) {
            bulkAddBtn.addEventListener('click', () => {
                bulkAddModal.classList.remove('hidden');
                bulkAddModal.classList.add('flex');
            });
        }
        if (cancelBulkAddBtn) {
            cancelBulkAddBtn.addEventListener('click', () => {
                bulkAddModal.classList.add('hidden');
                bulkAddModal.classList.remove('flex');
            });
        }
        if (confirmBulkAddBtn) {
            confirmBulkAddBtn.addEventListener('click', () => {
                const text = bulkAddTextarea.value;
                const newButtons = parseBulkButtons(text);
                if (newButtons.length > 0) {
                    if (buttonRows.length === 1 && buttonRows[0].length === 0) {
                        buttonRows = newButtons;
                    } else {
                        buttonRows.push(...newButtons);
                    }
                    renderButtonRows();
                    updateButtonsInput();
                }
                bulkAddTextarea.value = '';
                bulkAddModal.classList.add('hidden');
                bulkAddModal.classList.remove('flex');
            });
        }
    }

    initializeButtonEditor();
};