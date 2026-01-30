// This function will be called by the router when the cron section is loaded
async function initCron() {
    const addJobBtn = document.getElementById('add-job-btn');
    const jobModal = document.getElementById('job-modal');
    const jobModalContent = document.getElementById('job-modal-content');
    const jobModalClose = document.getElementById('job-modal-close');
    const jobModalCancelBtn = document.getElementById('job-modal-cancel-btn');
    const jobForm = document.getElementById('job-form');
    const jobTypeSelect = document.getElementById('job-type');
    const jobsList = document.getElementById('jobs-list');
    let codeEditor = null;

    const openModal = () => {
        jobModal.classList.remove('hidden');
        setTimeout(() => {
            jobModalContent.classList.remove('scale-95', 'opacity-0');
            
            // Initialize CodeMirror if the script editor is visible
            if (jobTypeSelect.value === 'script' && !codeEditor) {
                const textarea = document.getElementById('action-script-code');
                codeEditor = CodeMirror.fromTextArea(textarea, {
                    lineNumbers: true,
                    mode: 'javascript',
                    theme: 'dracula',
                    lineWrapping: true,
                });
                setTimeout(() => codeEditor.refresh(), 100); // Refresh to ensure proper rendering
            }
        }, 10);
    };

    const closeModal = () => {
        jobModalContent.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            jobModal.classList.add('hidden');
            // Destroy CodeMirror instance
            if (codeEditor) {
                codeEditor.toTextArea();
                codeEditor = null;
            }
        }, 200);
    };

    const updateActionSection = () => {
        document.querySelectorAll('.action-section').forEach(section => {
            section.classList.add('hidden');
        });
        const selectedType = jobTypeSelect.value;
        document.getElementById(`action-${selectedType}`).classList.remove('hidden');

        // Destroy existing CodeMirror instance if we are not on the script tab
        if (selectedType !== 'script' && codeEditor) {
            codeEditor.toTextArea();
            codeEditor = null;
        }

        // Initialize CodeMirror if we switched to the script tab
        if (selectedType === 'script' && !codeEditor && jobModal.classList.contains('hidden') === false) {
             const textarea = document.getElementById('action-script-code');
             codeEditor = CodeMirror.fromTextArea(textarea, {
                lineNumbers: true,
                mode: 'javascript',
                theme: 'dracula',
                lineWrapping: true,
             });
             setTimeout(() => codeEditor.refresh(), 100);
        }

        // Show broadcast options for relevant types
        const broadcastOptions = document.getElementById('broadcast-options');
        if (['script'].includes(selectedType)) {
            broadcastOptions.classList.remove('hidden');
        } else {
            broadcastOptions.classList.add('hidden');
        }
    };

    const updateBroadcastSections = () => {
        const broadcastEnabled = document.getElementById('job-broadcast-enabled').checked;
        const targetContainer = document.getElementById('broadcast-target-container');
        const customTargetContainer = document.getElementById('custom-target-container');
        const broadcastTarget = document.getElementById('job-broadcast-target').value;

        if (broadcastEnabled) {
            targetContainer.classList.remove('hidden');
            if (broadcastTarget === 'custom') {
                customTargetContainer.classList.remove('hidden');
            } else {
                customTargetContainer.classList.add('hidden');
            }
        } else {
            targetContainer.classList.add('hidden');
            customTargetContainer.classList.add('hidden');
        }
    };
    document.getElementById('job-broadcast-enabled').addEventListener('change', updateBroadcastSections);
    document.getElementById('job-broadcast-target').addEventListener('change', updateBroadcastSections);


    const fetchJobs = async () => {
        try {
            const response = await fetch('/api/cron');
            if (!response.ok) throw new Error('Failed to fetch jobs');
            const jobs = await response.json();
            renderJobs(jobs);
        } catch (error) {
            console.error('Error fetching jobs:', error);
            showToast('Failed to load jobs', 'error');
        }
    };

    const renderJobs = (jobs) => {
        jobsList.innerHTML = '';
        if (jobs.length === 0) {
            jobsList.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-500">No CRON jobs scheduled yet.</td></tr>';
            return;
        }

        jobs.forEach(job => {
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-800 hover:bg-gray-800/30 transition-colors';
            
            const lastRun = job.lastRun ? new Date(job.lastRun).toLocaleString() : 'Never';
            const statusColor = job.enabled ? 'bg-green-500' : 'bg-gray-600';

            row.innerHTML = `
                <td class="px-6 py-4">
                    <label class="inline-flex items-center cursor-pointer">
                        <input type="checkbox" value="" class="sr-only peer" ${job.enabled ? 'checked' : ''} data-id="${job._id}">
                        <div class="relative w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                </td>
                <td class="px-6 py-4 font-medium text-white">${job.name}</td>
                <td class="px-6 py-4 text-gray-400 font-mono">${job.schedule}</td>
                <td class="px-6 py-4 text-gray-400">${job.type}</td>
                <td class="px-6 py-4 text-gray-400">${lastRun}</td>
                <td class="px-6 py-4 text-right">
                    <button class="text-blue-500 hover:text-blue-400 mr-4 edit-btn" data-id="${job._id}">Edit</button>
                    <button class="text-red-500 hover:text-red-400 delete-btn" data-id="${job._id}">Delete</button>
                </td>
            `;
            jobsList.appendChild(row);
        });
    };

    const populateForm = (job) => {
        document.getElementById('job-id').value = job._id;
        document.getElementById('job-name').value = job.name;
        document.getElementById('job-schedule').value = job.schedule;
        document.getElementById('job-type').value = job.type;

        updateActionSection(); // To show the correct action section

        if (job.type === 'command') {
            document.getElementById('action-command-input').value = job.action.command;
        } else if (job.type === 'script') {
            // We need to wait for CodeMirror to be initialized
            setTimeout(() => {
                if (codeEditor) {
                    codeEditor.setValue(job.action.code);
                } else {
                     // Fallback for when editor is not yet ready
                    document.getElementById('action-script-code').value = job.action.code;
                }
            }, 100);
        }

        // Populate broadcast options
        if (job.broadcast) {
            document.getElementById('job-broadcast-enabled').checked = job.broadcast.enabled;
            document.getElementById('job-broadcast-target').value = job.broadcast.target;
            if (job.broadcast.target === 'custom' && Array.isArray(job.broadcast.customIds)) {
                document.getElementById('job-broadcast-custom-ids').value = job.broadcast.customIds.join('\n');
            } else {
                document.getElementById('job-broadcast-custom-ids').value = '';
            }
        } else {
            document.getElementById('job-broadcast-enabled').checked = false;
            document.getElementById('job-broadcast-target').value = 'owner';
            document.getElementById('job-broadcast-custom-ids').value = '';
        }
        updateBroadcastSections();
    };

    jobForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('job-id').value;
        const name = document.getElementById('job-name').value;
        const schedule = document.getElementById('job-schedule').value;
        const type = document.getElementById('job-type').value;

        let action = {};
        if (type === 'command') {
            action = { command: document.getElementById('action-command-input').value };
        } else if (type === 'script') {
            if (codeEditor) {
                action = { code: codeEditor.getValue() };
            } else {
                action = { code: document.getElementById('action-script-code').value };
            }
        }

        const broadcastEnabled = document.getElementById('job-broadcast-enabled').checked;
        const broadcastTarget = document.getElementById('job-broadcast-target').value;
        const broadcast = {
            enabled: broadcastEnabled,
            target: broadcastTarget
        };

        if (broadcastEnabled && broadcastTarget === 'custom') {
            const customIdsRaw = document.getElementById('job-broadcast-custom-ids').value;
            broadcast.customIds = customIdsRaw.split('\n').map(id => id.trim()).filter(id => id);
        }

        const jobData = { name, schedule, type, action, broadcast };

        try {
            const url = id ? `/api/cron/${id}` : '/api/cron';
            const method = id ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(jobData)
            });

            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.error || 'Failed to save job');
            }
            
            showToast(`Job ${id ? 'updated' : 'created'} successfully!`, 'success');
            closeModal();
            fetchJobs();
        } catch (error) {
            console.error('Error saving job:', error);
            showToast(error.message, 'error');
        }
    });

    jobsList.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.classList.contains('edit-btn')) {
            const id = target.dataset.id;
            try {
                const response = await fetch(`/api/cron/${id}`);
                if (!response.ok) throw new Error('Failed to fetch job details');
                const job = await response.json();
                
                document.getElementById('job-modal-title').textContent = 'Edit CRON Job';
                populateForm(job);
                openModal();
            } catch (error) {
                console.error('Error fetching job for edit:', error);
                showToast('Failed to load job details', 'error');
            }
        }

        // Handle delete button click
        if (target.classList.contains('delete-btn')) {
            const id = target.dataset.id;
            showConfirmationModal('Are you sure you want to delete this job?', async () => {
                try {
                    const response = await fetch(`/api/cron/${id}`, { method: 'DELETE' });
                    if (!response.ok) throw new Error('Failed to delete');
                    showToast('Job deleted successfully', 'success');
                    fetchJobs();
                } catch (error) {
                    console.error('Error deleting job:', error);
                    showToast('Failed to delete job', 'error');
                }
            });
        }
        
        // Handle toggle switch change
        if (target.type === 'checkbox') {
            const id = target.dataset.id;
            const enabled = target.checked;
            try {
                const response = await fetch(`/api/cron/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ enabled })
                });
                if (!response.ok) throw new Error('Failed to update status');
                showToast(`Job ${enabled ? 'enabled' : 'disabled'}`, 'success');
            } catch (error) {
                 console.error('Error updating job status:', error);
                 showToast('Failed to update job status', 'error');
                 target.checked = !enabled; // Revert checkbox on failure
            }
        }
    });

    addJobBtn.addEventListener('click', () => {
        jobForm.reset();
        document.getElementById('job-id').value = '';
        document.getElementById('job-modal-title').textContent = 'Add New CRON Job';
        updateActionSection();
        openModal();
    });

    jobTypeSelect.addEventListener('change', updateActionSection);
    jobModalClose.addEventListener('click', closeModal);
    jobModalCancelBtn.addEventListener('click', closeModal);
    jobModal.addEventListener('click', (e) => {
        if (e.target === jobModal) {
            closeModal();
        }
    });

    // Initial load
    updateActionSection();
    fetchJobs();
}
