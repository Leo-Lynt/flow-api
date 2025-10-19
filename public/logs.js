// Configuration
const API_BASE = window.location.origin;
let token = localStorage.getItem('authToken') || '';

// State
let liveTailActive = false;
let socket = null;
let currentStats = { total: 0, errors: 0, warnings: 0 };
let autoRefreshInterval = null;

// Session-based log tracking
let sessionLogs = []; // Logs collected in current session
let lastLogTimestamp = null; // Track last log timestamp for incremental fetch
let isSessionMode = true; // true = session mode, false = file viewing mode

// DOM Elements
let logsContainer, searchInput, levelFilter, methodFilter, fileSelect, clearBtn;
let statsTotal, statsErrors, statsWarnings, logoutBtn;

// Initialize
async function init() {
  // Check authentication
  if (!token) {
    showLoginModal();
    return;
  }

  // Hide login modal and show main container
  const loginModal = document.getElementById('login-modal');
  const mainContainer = document.getElementById('main-container');
  loginModal.style.display = 'none';
  mainContainer.style.display = 'block';

  // Initialize DOM elements
  logsContainer = document.getElementById('logs-container');
  searchInput = document.getElementById('search');
  levelFilter = document.getElementById('level-filter');
  methodFilter = document.getElementById('method-filter');
  fileSelect = document.getElementById('file-select');
  clearBtn = document.getElementById('clear-btn');
  statsTotal = document.getElementById('stats-total');
  statsErrors = document.getElementById('stats-errors');
  statsWarnings = document.getElementById('stats-warnings');
  logoutBtn = document.getElementById('logout-btn');

  await loadLogFiles();

  // Initialize session with current timestamp
  lastLogTimestamp = new Date().toISOString();
  console.log('Session started. Watching for new logs after:', lastLogTimestamp);

  setupEventListeners();
  setupSocketConnection();
  startAutoRefresh();

  // Show initial message
  logsContainer.innerHTML = '<div class="text-center py-10 text-gray-600">Session started - watching for new logs...</div>';
}

// Show login modal
function showLoginModal() {
  const loginModal = document.getElementById('login-modal');
  const mainContainer = document.getElementById('main-container');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');

  loginModal.style.display = 'flex';
  mainContainer.style.display = 'none';

  loginForm.onsubmit = async (e) => {
    e.preventDefault();

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      console.log('Login response:', data);

      // Check different token locations
      const authToken = data.data?.tokens?.accessToken || data.data?.token || data.token;

      if (data.success && authToken) {
        console.log('Login successful, token:', authToken);
        token = authToken;
        localStorage.setItem('authToken', token);

        // Hide login modal
        console.log('Hiding login modal...');
        loginModal.style.display = 'none';
        mainContainer.style.display = 'block';
        console.log('Main container displayed');

        // Initialize app
        logsContainer = document.getElementById('logs-container');
        searchInput = document.getElementById('search');
        levelFilter = document.getElementById('level-filter');
        methodFilter = document.getElementById('method-filter');
        fileSelect = document.getElementById('file-select');
        clearBtn = document.getElementById('clear-btn');
        statsTotal = document.getElementById('stats-total');
        statsErrors = document.getElementById('stats-errors');
        statsWarnings = document.getElementById('stats-warnings');
        logoutBtn = document.getElementById('logout-btn');

        console.log('Loading logs...');

        // Initialize session
        lastLogTimestamp = new Date().toISOString();
        console.log('Session started. Watching for new logs after:', lastLogTimestamp);

        await loadLogFiles();
        setupEventListeners();
        setupSocketConnection();
        startAutoRefresh();

        // Show initial message
        logsContainer.innerHTML = '<div class="text-center py-10 text-gray-600">Session started - watching for new logs...</div>';

        console.log('App initialized');
      } else {
        console.error('Login failed:', data);
        loginError.textContent = data.message || 'Invalid credentials';
      }
    } catch (error) {
      loginError.textContent = 'Login failed. Please try again.';
      console.error('Login error:', error);
    }
  };
}

// Logout
function logout() {
  token = '';
  localStorage.removeItem('authToken');
  location.reload();
}

// Load available log files
async function loadLogFiles() {
  try {
    const response = await fetch(`${API_BASE}/api/logs/files`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();

    if (data.success) {
      fileSelect.innerHTML = '<option value="">Session (Live)</option>';
      data.data.files.forEach(file => {
        const option = document.createElement('option');
        option.value = file;
        option.textContent = `File: ${file}`;
        fileSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Failed to load log files:', error);
  }
}

// Load logs (incremental for session, full for file view)
async function loadLogs(silent = false) {
  try {
    const search = searchInput.value;
    const level = levelFilter.value;
    const method = methodFilter.value;
    const filename = fileSelect.value;

    if (isSessionMode) {
      // SESSION MODE: Fetch only new logs since last timestamp
      await loadSessionLogs(silent, search, level, method);
    } else {
      // FILE MODE: Load full log file
      await loadFileLog(silent, search, level, method, filename);
    }
  } catch (error) {
    console.error('Failed to load logs:', error);
    if (!silent) {
      logsContainer.innerHTML = '<div class="text-center py-10 text-gray-600">Failed to load logs</div>';
    }
  }
}

// Load session logs incrementally
async function loadSessionLogs(silent, search, level, method) {
  let url = `${API_BASE}/api/logs/today?limit=500`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (level) url += `&level=${level}`;

  console.log('Fetching session logs. Last timestamp:', lastLogTimestamp);

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const data = await response.json();

  if (data.success) {
    let logs = data.data.logs;
    console.log(`Received ${logs.length} total logs from API`);

    // Filter out logs from /api/logs endpoints
    logs = logs.filter(log => !log.url || !log.url.startsWith('/api/logs'));
    console.log(`After filtering /api/logs: ${logs.length} logs`);

    // Get only logs AFTER lastLogTimestamp
    let newLogs = logs.filter(log => {
      if (!lastLogTimestamp) return true;
      return new Date(log.timestamp) > new Date(lastLogTimestamp);
    });

    console.log(`New logs after timestamp filter: ${newLogs.length}`);

    // Client-side filter by method
    if (method) {
      newLogs = newLogs.filter(log => log.method === method);
      console.log(`After method filter: ${newLogs.length} logs`);
    }

    if (newLogs.length > 0) {
      console.log(`✅ Found ${newLogs.length} NEW logs to display!`);

      // Add to session logs
      sessionLogs = [...newLogs, ...sessionLogs];

      // Update last timestamp
      const latestLog = newLogs.reduce((latest, log) =>
        new Date(log.timestamp) > new Date(latest.timestamp) ? log : latest
      );
      lastLogTimestamp = latestLog.timestamp;
      console.log('Updated last timestamp to:', lastLogTimestamp);

      // Display new logs
      appendNewLogs(newLogs);
      updateStats(sessionLogs);
    } else {
      console.log('No new logs found');
    }
  } else {
    console.error('API error:', data);
  }
}

// Load full log file
async function loadFileLog(silent, search, level, method, filename) {
  let url = `${API_BASE}/api/logs/today?limit=200`;
  if (filename) {
    // TODO: Add endpoint to read specific file
    url = `${API_BASE}/api/logs/today?limit=200`;
  }
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (level) url += `&level=${level}`;

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const data = await response.json();

  if (data.success) {
    let logs = data.data.logs;

    // Filter out logs from /api/logs endpoints
    logs = logs.filter(log => !log.url || !log.url.startsWith('/api/logs'));

    // Client-side filter by method
    if (method) {
      logs = logs.filter(log => log.method === method);
    }

    displayLogs(logs);
    updateStats(logs);
  }
}

// Display logs
function displayLogs(logs) {
  if (!logs || logs.length === 0) {
    logsContainer.innerHTML = '<div class="text-center py-10 text-gray-600">No logs found</div>';
    return;
  }

  logsContainer.innerHTML = logs.map(log => createLogEntry(log)).join('');
}


// Append new logs to the top of the container
function appendNewLogs(newLogs) {
  if (!newLogs || newLogs.length === 0) return;

  // Create HTML for new logs
  const newLogsHtml = newLogs.map(log => createLogEntry(log)).join('');

  // Check if container is empty
  if (logsContainer.innerHTML.includes('No logs found') ||
      logsContainer.innerHTML.includes('Logs cleared')) {
    logsContainer.innerHTML = newLogsHtml;
  } else {
    // Prepend new logs to the top
    logsContainer.insertAdjacentHTML('afterbegin', newLogsHtml);
  }

  // Add a visual flash effect to new logs
  const newElements = logsContainer.querySelectorAll('.mb-3');
  for (let i = 0; i < newLogs.length && i < newElements.length; i++) {
    newElements[i].classList.add('bg-green-900');
    setTimeout(() => {
      newElements[i].classList.remove('bg-green-900');
    }, 2000);
  }
}

// Create log entry HTML - Minimalist Light Theme
function createLogEntry(log) {
  const timestamp = new Date(log.timestamp).toLocaleTimeString('pt-BR');
  const id = `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const isSuccess = log.statusCode >= 200 && log.statusCode < 300;
  const isError = log.statusCode >= 400;

  let icon = 'mdi:circle-outline';
  let colorClass = 'text-gray-400';

  if (isSuccess) {
    icon = 'mdi:check-circle';
    colorClass = 'text-success';
  } else if (isError) {
    icon = 'mdi:alert-circle';
    colorClass = 'text-error';
  }

  const methodColors = {
    GET: 'bg-blue-500',
    POST: 'bg-green-500',
    PUT: 'bg-yellow-500',
    DELETE: 'bg-red-500',
    PATCH: 'bg-purple-500'
  };

  return `
    <div class="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition">
      <div class="flex items-center gap-4 p-4 cursor-pointer" onclick="toggleDetails('${id}')">
        <span class="iconify ${colorClass} text-2xl" data-icon="${icon}"></span>
        <span class="text-sm text-gray-500 w-20">${timestamp}</span>
        ${log.method ? `<span class="px-2 py-1 ${methodColors[log.method] || 'bg-gray-500'} text-white text-xs font-semibold rounded">${log.method}</span>` : ''}
        <span class="flex-1 text-gray-900 font-medium truncate">${escapeHtml(log.url || log.message || 'Event')}</span>
        ${log.statusCode ? `<span class="px-3 py-1 ${isSuccess ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} text-sm font-semibold rounded-lg">${log.statusCode}</span>` : ''}
        ${log.duration ? `<span class="text-gray-500 text-sm">${log.duration}ms</span>` : ''}
        <span class="iconify text-gray-400" data-icon="mdi:chevron-down"></span>
      </div>

      <div id="${id}-details" class="hidden border-t border-gray-100 p-6 bg-gray-50 space-y-4">
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div><span class="text-gray-500">Correlation ID:</span> <span class="text-gray-900 font-mono text-xs ml-2">${log.correlationId || 'N/A'}</span></div>
          <div><span class="text-gray-500">User ID:</span> <span class="text-gray-900 ml-2">${log.userId || 'N/A'}</span></div>
          <div><span class="text-gray-500">IP:</span> <span class="text-gray-900 ml-2">${log.ip || 'N/A'}</span></div>
          <div><span class="text-gray-500">Duration:</span> <span class="text-gray-900 ml-2">${log.duration || 0}ms</span></div>
        </div>

        ${log.responseBody ? `
          <div>
            <div class="flex items-center gap-2 mb-3">
              <span class="iconify text-primary text-xl" data-icon="mdi:code-json"></span>
              <span class="font-semibold text-gray-900">Response</span>
            </div>
            <pre class="bg-white border border-gray-300 rounded-lg p-4 text-xs overflow-x-auto text-gray-800 max-h-96"><code>${escapeHtml(JSON.stringify(log.responseBody, null, 2))}</code></pre>
          </div>
        ` : ''}

        ${log.requestBody ? `
          <div>
            <div class="flex items-center gap-2 mb-3">
              <span class="iconify text-primary text-xl" data-icon="mdi:upload"></span>
              <span class="font-semibold text-gray-900">Request Body</span>
            </div>
            <pre class="bg-white border border-gray-300 rounded-lg p-4 text-xs overflow-x-auto text-gray-800"><code>${escapeHtml(JSON.stringify(log.requestBody, null, 2))}</code></pre>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

// Update stats
function updateStats(logs) {
  currentStats.total = logs.length;
  currentStats.errors = logs.filter(l => l.level === 'error').length;
  currentStats.warnings = logs.filter(l => l.level === 'warn').length;

  statsTotal.textContent = `Total: ${currentStats.total}`;
  statsErrors.textContent = `Errors: ${currentStats.errors}`;
  statsWarnings.textContent = `Warnings: ${currentStats.warnings}`;
}

// Setup Socket.io connection
function setupSocketConnection() {
  socket = io(API_BASE);

  socket.on('connect', () => {
    console.log('Connected to log stream');
  });

  socket.on('log-entry', (log) => {
    if (liveTailActive) {
      const entry = createLogEntry(log);
      logsContainer.insertAdjacentHTML('afterbegin', entry);

      // Update stats
      currentStats.total++;
      if (log.level === 'error') currentStats.errors++;
      if (log.level === 'warn') currentStats.warnings++;
      updateStats([]);
    }
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
}

// Toggle live tail
function toggleLiveTail() {
  liveTailActive = !liveTailActive;

  if (liveTailActive) {
    liveTailBtn.textContent = 'Live Tail: ON';
    liveTailBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
    liveTailBtn.classList.add('bg-green-600', 'hover:bg-green-700');
    socket.emit('tail-logs', { filename: fileSelect.value });
  } else {
    liveTailBtn.textContent = 'Live Tail: OFF';
    liveTailBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
    liveTailBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
    socket.emit('stop-tail');
  }
}

// Setup event listeners
function setupEventListeners() {
  clearBtn.addEventListener('click', () => {
    // Clear session logs
    sessionLogs = [];
    console.log('Session logs cleared. Continuing to watch for new logs...');

    logsContainer.innerHTML = '<div class="text-center py-10 text-gray-600">Session cleared - watching for new logs...</div>';
    currentStats = { total: 0, errors: 0, warnings: 0 };
    updateStats([]);
  });

  logoutBtn.addEventListener('click', logout);

  searchInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      loadLogs();
    }
  });

  levelFilter.addEventListener('change', loadLogs);
  methodFilter.addEventListener('change', loadLogs);

  fileSelect.addEventListener('change', () => {
    const selectedFile = fileSelect.value;

    if (!selectedFile || selectedFile === '') {
      // Switch back to session mode
      isSessionMode = true;
      console.log('Switched to SESSION mode');
      logsContainer.innerHTML = '<div class="text-center py-10 text-gray-600">Session mode - watching for new logs...</div>';
    } else {
      // Switch to file viewing mode
      isSessionMode = false;
      console.log('Switched to FILE mode:', selectedFile);
      loadLogs();
    }
  });
}

// Auto-refresh logs every 2 seconds
function startAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
  }

  console.log('Auto-refresh started (every 2 seconds)');

  autoRefreshInterval = setInterval(async () => {
    if (isSessionMode) {
      console.log('Auto-refreshing session logs...');
      await loadLogs(true); // Silent refresh
    }
  }, 2000); // Refresh every 2 seconds
}

// Stop auto-refresh
function stopAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
  }
}

// Utility: Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Toggle log details
window.toggleDetails = function(id) {
  const details = document.getElementById(`${id}-details`);

  if (details.classList.contains('hidden')) {
    details.classList.remove('hidden');
  } else {
    details.classList.add('hidden');
  }
};

// Start
init();
