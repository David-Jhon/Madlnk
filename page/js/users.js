window.initUsers = function () {
    let currentPage = 1;
    let currentLimit = 10;
    let totalUsers = 0;
    let searchTimeout = null;
    let selectedUserId = null;

    // Elements
    const searchInput = document.getElementById('user-search');
    const filterSelect = document.getElementById('user-filter');
    const sortSelect = document.getElementById('user-sort');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const tableBody = document.getElementById('users-table-body');

    if (!searchInput || !tableBody) {
        console.error('Required elements not found');
        return;
    }

    // Initial Load
    fetchUsers();

    // Event Listeners
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentPage = 1;
            fetchUsers();
        }, 500);
    });

    filterSelect.addEventListener('change', () => { currentPage = 1; fetchUsers(); });
    sortSelect.addEventListener('change', () => { currentPage = 1; fetchUsers(); });
    prevBtn.addEventListener('click', () => { if (currentPage > 1) { currentPage--; fetchUsers(); } });
    nextBtn.addEventListener('click', () => { if (currentPage * currentLimit < totalUsers) { currentPage++; fetchUsers(); } });

    async function fetchUsers() {
        try {
            const search = searchInput.value;
            const filter = filterSelect.value;
            const sort = sortSelect.value;

            const res = await fetch(`/api/users?page=${currentPage}&limit=${currentLimit}&search=${search}&filter=${filter}&sort=${sort}`);
            const data = await res.json();

            totalUsers = data.total;
            renderTable(data.users);
            updatePagination(data);
        } catch (error) {
            console.error('Error fetching users:', error);
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="7" class="py-8 text-center text-red-500">Error loading data</td></tr>';
        }
    }

    function renderTable(users) {
        if (!tableBody) return;

        if (users.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="py-8 text-center text-gray-500">No users found</td></tr>';
            return;
        }

        tableBody.innerHTML = users.map(user => {
            const joined = new Date(user.joined).toLocaleDateString();
            const lastActive = new Date(user.lastActivity).toLocaleString();
            const isBlocked = user.isBlocked;

            return `
                <tr class="hover:bg-gray-800/30 transition-colors group">
                    <td class="py-4 px-6">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center text-sm font-bold text-white shadow-lg">
                                ${user.firstName.charAt(0)}
                            </div>
                            <div>
                                <div class="font-medium text-white">${user.firstName} ${user.lastName || ''}</div>
                                <div class="text-xs text-gray-500 md:hidden">@${user.username || 'N/A'}</div>
                            </div>
                        </div>
                    </td>
                    <td class="py-4 px-6 text-gray-400 font-mono text-xs">${user.userId}</td>
                    <td class="py-4 px-6 text-gray-400">@${user.username || 'N/A'}</td>
                    <td class="py-4 px-6 text-gray-400">${joined}</td>
                    <td class="py-4 px-6 text-gray-400">${lastActive}</td>
                    <td class="py-4 px-6">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isBlocked ? 'bg-red-400/10 text-red-400' : 'bg-green-400/10 text-green-400'}">
                            ${isBlocked ? 'Blocked' : 'Active'}
                        </span>
                    </td>
                    <td class="py-4 px-6 text-right">
                        <div class="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onclick="openMessageModal('${user.userId}', '${user.username || user.firstName}')" class="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors" title="Message">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                            </button>
                            <button onclick="toggleBlock('${user.userId}')" class="p-2 ${isBlocked ? 'text-green-400 hover:text-green-300' : 'text-red-400 hover:text-red-300'} hover:bg-gray-700 rounded-lg transition-colors" title="${isBlocked ? 'Unblock' : 'Block'}">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function updatePagination(data) {
        const start = (data.page - 1) * currentLimit + 1;
        const end = Math.min(data.page * currentLimit, data.total);

        if (document.getElementById('page-info-start')) document.getElementById('page-info-start').textContent = data.total === 0 ? 0 : start;
        if (document.getElementById('page-info-end')) document.getElementById('page-info-end').textContent = end;
        if (document.getElementById('page-info-total')) document.getElementById('page-info-total').textContent = data.total;

        if (prevBtn) prevBtn.disabled = data.page === 1;
        if (nextBtn) nextBtn.disabled = data.page >= data.totalPages;
    }

    // Global Actions
    window.toggleBlock = async (userId) => {
        showConfirmationModal('Are you sure you want to change this user\'s block status?', async () => {
            try {
                const res = await fetch(`/api/users/${userId}/block`, { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    showToast('User status updated', 'success');
                    fetchUsers();
                } else {
                    showToast(data.error || 'Failed to update status', 'error');
                }
            } catch (error) {
                console.error('Error blocking user:', error);
                showToast('Error updating status', 'error');
            }
        });
    };

    window.openMessageModal = (userId, username) => {
        selectedUserId = userId;
        document.getElementById('msg-modal-username').textContent = '@' + username;
        document.getElementById('message-modal').classList.remove('hidden');
    };

    window.closeMessageModal = () => {
        document.getElementById('message-modal').classList.add('hidden');
        document.getElementById('msg-modal-text').value = '';
        selectedUserId = null;
    };

    window.sendMessage = async () => {
        const message = document.getElementById('msg-modal-text').value;
        if (!message) return showToast('Please enter a message', 'info');

        try {
            const res = await fetch(`/api/users/${selectedUserId}/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            });

            if (res.ok) {
                showToast('Message sent successfully', 'success');
                closeMessageModal();
            } else {
                showToast('Failed to send message', 'error');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            showToast('Error sending message', 'error');
        }
    };
};
